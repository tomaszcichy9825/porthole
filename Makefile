.DEFAULT_GOAL := help
APP_DIR := app

.PHONY: help setup start ios android desktop team ipad prebuild lint test typecheck build-preview release

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: ## Install app dependencies
	cd $(APP_DIR) && npm install

start: ## Start the Expo dev server (dev build required, not Expo Go)
	cd $(APP_DIR) && npx expo start

ios: ## Build and run the dev build on iOS
	cd $(APP_DIR) && npx expo run:ios

android: ## Build and run the dev build on Android
	cd $(APP_DIR) && npx expo run:android

# macOS runs iOS apps only when (a) they carry a real signature - ad-hoc is
# rejected - and (b) they sit in the App Store "wrapped bundle" layout
# (Wrapper/ + WrappedBundle symlink); a bare .app fails with "incorrect
# executable format" either way. A free personal team is enough: Xcode >
# Settings > Accounts > add your Apple ID, then `make team` for the id.
desktop: ## Build and run on this Mac. Usage: make desktop TEAM=XXXXXXXXXX
	@test -n "$(TEAM)" || (echo "TEAM is required: add your Apple ID in Xcode (Settings > Accounts, free), then run 'make team' to find the id and 'make desktop TEAM=<id>'" && exit 1)
	@test -d $(APP_DIR)/ios || (cd $(APP_DIR) && npx expo prebuild -p ios)
	cd $(APP_DIR)/ios && xcodebuild -workspace Porthole.xcworkspace -scheme Porthole \
		-configuration Debug -destination 'platform=macOS,variant=Designed for iPad' \
		-derivedDataPath build -allowProvisioningUpdates \
		CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=$(TEAM) build
	@APP=$$(find $(APP_DIR)/ios/build/Build/Products -maxdepth 2 -name '*.app' | head -1); \
		rm -rf /Applications/Porthole.app; \
		mkdir -p /Applications/Porthole.app/Wrapper; \
		cp -R "$$APP" /Applications/Porthole.app/Wrapper/; \
		ln -sf Wrapper/Porthole.app /Applications/Porthole.app/WrappedBundle; \
		echo "Launching /Applications/Porthole.app"; open /Applications/Porthole.app; \
		echo "If it quits at once: Gatekeeper rejects each new development build until you allow it in System Settings > Privacy & Security > Open Anyway"

team: ## Show Apple development team ids available on this Mac
	@IDS=$$( (security find-identity -v -p codesigning | grep -oE '\(([A-Z0-9]{10})\)' | tr -d '()'; \
		defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null | grep -oE 'teamID = [A-Z0-9]{10}' | awk '{print $$3}') | sort -u); \
		if [ -n "$$IDS" ]; then echo "$$IDS"; else echo "none - add your Apple ID in Xcode first (Settings > Accounts)"; fi

ipad: ## Run on an iPad simulator (desktop rail layout, no signing needed)
	cd $(APP_DIR) && npx expo run:ios --device "iPad Pro 13-inch (M5)"

prebuild: ## Regenerate native projects (CNG)
	cd $(APP_DIR) && npx expo prebuild --clean

lint: ## Lint the app
	cd $(APP_DIR) && npm run lint

typecheck: ## Typecheck the app
	cd $(APP_DIR) && npx tsc --noEmit

test: ## Run unit tests
	cd $(APP_DIR) && npm test

build-preview: ## EAS preview build for internal testing
	cd $(APP_DIR) && eas build --profile preview --platform all

release: ## Tag and push a release: make release V=0.1.0
	@test -n "$(V)" || (echo "usage: make release V=X.Y.Z" && exit 1)
	git tag v$(V) && git push origin v$(V)
