# Setup Instructions

## Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/preetansh24/TerraFlux.git
   cd carbonloop
   npm install
   ```

2. **Environment Variables**
   ```bash
   cp .env.example .env
   # Inside packages/backend and packages/frontend, you can also set up specific envs if needed.
   ```
   > **IMPORTANT - API Key Security**: You must provide your own API keys (e.g., `GROQ_API_KEY`) in the `.env` file. **Never commit `.env` or hardcode API keys anywhere in the codebase.** The `.gitignore` is configured to ignore `.env` files. Ensure you do not accidentally expose your keys in git commits or client-side code.

3. **Start Development Servers**
   ```bash
   npm run dev
   ```
