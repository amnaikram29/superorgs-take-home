# S&P 500 Analytics Chat Assistant

A conversational analytics assistant for historical S&P 500 stock data. Ask natural-language questions and get back interactive charts, KPI cards, and narrative insights.

## Quick Start

### 1. Prerequisites
- **Docker**: Ensure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is installed and running.

### 2. Configuration
Create a `.env` file in the root directory (use `.env.example` as a template) and configure your LLM provider:

```env
# Choose 'anthropic' or 'openai'
LLM_PROVIDER=anthropic

# Add your API key
ANTHROPIC_API_KEY=your_api_key_here
# OR
OPENAI_API_KEY=your_api_key_here
```

### 3. Run the Application
Execute the setup script for your operating system to build and start the services:

**Mac / Linux**
```bash
bash setup.sh
```

**Windows (PowerShell)**
```powershell
.\setup.ps1
```

Once started, the application will be available at:
- **Frontend**: http://localhost:3000
- **Backend Health**: http://localhost:5000/health

---

## Features
- **Natural Language to SQL**: The agent automatically translates your questions into database queries.
- **Dynamic Visualizations**: Automatically renders charts and KPI cards based on the data.
- **Streaming Responses**: Watch the agent "think" and respond in real-time.
- **SQLite Database**: Self-contained database seeded automatically from historical S&P 500 data.

## Useful Commands
- **Stop containers**: `docker compose down`
- **View logs**: `docker compose logs -f backend`
- **Full reset (deletes database)**: `make clean`
- **Rebuild**: `docker compose up --build -d`
