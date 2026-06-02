.PHONY: check install help

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

check: check-docker check-bun ## Check if all required dependencies are installed

check-docker: ## Check if Docker is installed
	@command -v docker >/dev/null 2>&1 || { echo "Error: Docker is not installed."; exit 1; }
	@echo "Docker is installed: $$(docker --version)"

check-bun: ## Check if Bun is installed
	@command -v bun >/dev/null 2>&1 || { echo "Error: Bun is not installed."; exit 1; }
	@echo "Bun is installed: $$(bun --version)"

install: install-docker install-bun install-camoufox-deps fix-docker-permissions ## Install missing dependencies

install-docker: ## Install Docker if missing
	@command -v docker >/dev/null 2>&1 && echo "Docker already installed" || { \
		echo "Installing Docker..."; \
		if [ "$$(uname)" = "Darwin" ]; then \
			brew install --cask docker; \
		elif [ "$$(uname)" = "Linux" ]; then \
			sudo apt-get update; \
			sudo apt-get install -y ca-certificates curl; \
			sudo install -m 0755 -d /etc/apt/keyrings; \
			sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc; \
			sudo chmod a+r /etc/apt/keyrings/docker.asc; \
			echo "deb [arch=$$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $$(. /etc/os-release && echo $$VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null; \
			sudo apt-get update; \
			sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; \
		else \
			echo "Unsupported OS. Please install Docker manually from https://www.docker.com/get-started"; \
			exit 1; \
		fi; \
		echo "Docker installed successfully"; \
	}

fix-docker-permissions: ## Add current user to docker group (Linux only)
	@if [ "$$(uname)" = "Linux" ]; then \
		if id -nG "$$(whoami)" | grep -qw docker; then \
			echo "User '$$(whoami)' is already in the docker group"; \
		else \
			echo "Adding user '$$(whoami)' to docker group..."; \
			sudo usermod -aG docker $$(whoami); \
			echo ""; \
			echo "Permissions updated. Run 'newgrp docker' or log out and back in to apply."; \
		fi; \
	fi

install-bun: ## Install Bun if missing
	@command -v bun >/dev/null 2>&1 && echo "Bun already installed" || { \
		echo "Installing Bun..."; \
		if [ "$$(uname)" = "Darwin" ]; then \
			brew install oven-sh/bun/bun; \
		elif [ "$$(uname)" = "Linux" ]; then \
			sudo apt-get update; \
			sudo apt-get install -y unzip; \
			curl -fsSL https://bun.sh/install | bash; \
			export PATH="$$HOME/.bun/bin:$$PATH"; \
			echo ""; \
			echo "Bun installed. Run 'source ~/.bashrc' or restart your terminal to add bun to your PATH."; \
		else \
			echo "Unsupported OS. Please install Bun manually from https://bun.sh/docs/installation"; \
			exit 1; \
		fi; \
		echo "Bun installed successfully"; \
	}

install-camoufox-deps: ## Install Camoufox browser dependencies (Linux only)
	@if [ "$$(uname)" = "Linux" ]; then \
		echo "Installing Camoufox browser dependencies..."; \
		sudo apt-get update; \
		sudo apt-get install -y --no-install-recommends \
			fonts-liberation \
			xvfb \
			libasound2 \
			libatk-bridge2.0-0 \
			libatk1.0-0 \
			libc6 \
			libcairo2 \
			libcups2 \
			libdbus-1-3 \
			libexpat1 \
			libfontconfig1 \
			libgbm1 \
			libgcc-s1 \
			libglib2.0-0 \
			libgtk-3-0 \
			libnspr4 \
			libnss3 \
			libpango-1.0-0 \
			libpangocairo-1.0-0 \
			libstdc++6 \
			libx11-6 \
			libx11-xcb1 \
			libxcb1 \
			libxcomposite1 \
			libxcursor1 \
			libxdamage1 \
			libxext6 \
			libxfixes3 \
			libxi6 \
			libxrandr2 \
			libxrender1 \
			libxss1 \
			libxtst6 \
			lsb-release \
			xdg-utils; \
		echo "Camoufox dependencies installed successfully"; \
	elif [ "$$(uname)" = "Darwin" ]; then \
		echo "macOS: Camoufox binaries include all dependencies, no additional setup needed"; \
	else \
		echo "Unsupported OS. Install Firefox dependencies manually."; \
	fi
