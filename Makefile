.DEFAULT_GOAL := help
APP_DIR := app

.PHONY: help setup start ios android desktop prebuild lint test typecheck build-preview release

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

desktop: ## Build and run on this Mac (Apple Silicon, iOS app "Designed for iPad")
	@test -d $(APP_DIR)/ios || (cd $(APP_DIR) && npx expo prebuild -p ios)
	cd $(APP_DIR)/ios && xcodebuild -workspace Porthole.xcworkspace -scheme Porthole \
		-configuration Debug -destination 'platform=macOS,variant=Designed for iPad' \
		-derivedDataPath build build
	@APP=$$(find $(APP_DIR)/ios/build/Build/Products -maxdepth 2 -name '*.app' | head -1); \
		echo "Launching $$APP"; open "$$APP"

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
