tradingview-quant-lab/
├── CLAUDE.md
├── README.md
├── .gitignore
├── .env.example
│
├── .claude/
│   ├── settings.json
│   └── skills/
│       ├── tradingview-market-scanner/
│       │   ├── SKILL.md
│       │   ├── scoring.md
│       │   ├── risk-management.md
│       │   └── output-template.md
│       │
│       └── tradingview-strategy-research/
│           ├── SKILL.md
│           ├── validation-protocol.md
│           ├── walk-forward.md
│           └── monte-carlo.md
│
├── config/
│   ├── scanner.yaml
│   ├── risk.yaml
│   └── validation.yaml
│
├── strategies/
│   ├── registry.yaml
│   ├── pine/
│   ├── experimental/
│   ├── validated/
│   └── rejected/
│
├── reports/
│   ├── scans/
│   ├── backtests/
│   └── validations/
│
├── research/
├── tests/
└── scripts/