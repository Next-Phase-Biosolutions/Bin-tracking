# Domain-Specific AI Platform for Cattle Slaughterhouse Operations
## End-to-End Strategy: From Animal Intake to Packaged Product

---

## FINAL SIMPLIFIED ARCHITECTURE (Fully Cloud — No Mac Mini, No Jetson)

After working through cost/complexity trade-offs, the chosen starting architecture removes all owned hardware (Mac Mini, Jetson Orin) in favor of a single DigitalOcean droplet + Supabase + Claude API. This is the cheapest, simplest path to validate the product before investing in edge hardware.

### Final Flow

```
PLANT (Canada)                          DIGITALOCEAN (Toronto droplet)
──────────────────                      ──────────────────────────────
📷 Cheap camera ($200)                  🖥️ Single Droplet runs:
   takes photo of carcass                  - Fastify API (tablets, sensors)
      ↓ uploads photo                      - Grading model (EfficientNet-B5,
📱 Worker tablets ──────────────────→        CPU inference, ~1-2 sec/image)
🌡️ Temp sensors ──────────────────→        - AI agents (call Claude API)
                                            - RAG logic (searches Supabase)
                                         💾 Supabase (DB + pgvector)
                                         🤖 Claude API (Anthropic cloud)
                                            — answers domain LLM questions

Manager (anywhere) → browser → same droplet → gets answers
```

### What Each Piece Does

| Piece | Role | Cost |
|-------|------|------|
| DigitalOcean Droplet | Runs API, grading model, AI agents, RAG | $24–96/month (scales with usage) |
| Supabase | Database + pgvector (document/data storage) | $25/month |
| Claude API | Domain LLM brain (answers questions via RAG) | $20–80/month |
| Cheap camera | Captures carcass photo at grading station | $200 one-time |
| **Total Year 1** | | **~$850–2,500** (no hardware investment) |

### Grading Flow (No Jetson)
```
1. Camera takes photo → uploads to droplet over plant's normal internet
2. Droplet runs EfficientNet-B5 (CPU inference, fine-tuned on your data)
3. Result returned in 1-2 seconds (acceptable — carcasses move every 10-20 sec)
4. Grade saved to Supabase, label printed at station
```

### Domain LLM Flow (No Mac Mini)
```
1. Question asked (manager, worker, or automated agent trigger)
2. Droplet searches Supabase pgvector for relevant docs (CFIA/USDA rules, 
   your historical carcass data, SOPs)
3. Droplet sends question + retrieved context to Claude API
4. Claude generates the answer, returned to user
```

### Upgrade Path (Only When Justified by Scale)
```
Add Jetson Orin per station  → when throughput/latency demands real-time grading
Add dedicated GPU droplet    → when self-hosting a local LLM becomes cheaper 
                                 than per-call Claude API costs (high volume)
Add Canada-specific compute  → only if added geographic complexity (e.g. team 
                                 distributed across countries) reintroduces latency
```

This fully-cloud approach intentionally defers all hardware capex until the core product (tracking + grading + domain assistant) is validated with real plant data.

---

## Context

The bin-tracker project is already a production-quality Stage 9 (By-Products) tracking system with employee time tracking, payroll, blockchain anchoring, and a 4-phase expansion roadmap covering all 11 slaughterhouse stages. The user wants to layer domain-specific AI on top — including computer vision for meat grading and a domain LLM — to differentiate from manual/legacy competitors.

**Current tech:** Fastify + tRPC + Prisma + Supabase + React + Cardano blockchain + Anthropic SDK (already integrated) + Google Generative AI (already integrated)

---

## The Three AI Layers You Need

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: Domain LLM (Claude + RAG)                     │
│  "Ask anything about your facility, grading, yield..."  │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: Predictive Models (XGBoost, LSTM)             │
│  Yield prediction, anomaly detection, demand forecast   │
├─────────────────────────────────────────────────────────┤
│  LAYER 1: Computer Vision (EfficientNet + Jetson)       │
│  Meat grading (A/AA/AAA), contamination detection       │
└─────────────────────────────────────────────────────────┘
         ↓ all built on top of ↓
┌─────────────────────────────────────────────────────────┐
│  EXISTING: 11-Stage ERP Platform (bin-tracker)          │
│  Animal → Slaughter → Grade → Chill → Fab → Package    │
└─────────────────────────────────────────────────────────┘
```

---

## The 11 Operations + Where AI Fits

| Stage | Operation | Manual Today | AI Adds |
|-------|-----------|-------------|---------|
| 1 | Animal Intake / Lairage | Paper, RFID scan | Auto-link to CFIA/NLIS database, voice health notes |
| 2 | Slaughter | Operator records | Bleed-time anomaly detection |
| 3 | Ante-mortem Inspection | CFIA inspector | AI pre-flags anomalies before inspector |
| 4 | **Grading** | USDA/CFIA inspector eyes | **Computer Vision (A/AA/AAA + marbling score)** |
| 5 | Chilling & Aging | Manual temp logs | Anomaly detection (temp excursion alert) |
| 6 | Fabrication | Knife + scale | Yield prediction per cut |
| 7 | Packaging | Label printer | Contamination detection CV on line |
| 8 | Inventory | Manual count | Demand forecasting, FIFO optimization |
| 9 | By-Products | **Already built** | DK compliance (done) |
| 10 | Sales & Dispatch | Manual BOL | Route optimization |
| 11 | Compliance & Recall | Audit binders | Auto-trace forward/backward in <2 min |

---

## LAYER 1: Computer Vision for Meat Grading

### How USDA/CFIA Grading Works (What the Camera Must See)

The carcass is split at the 12th–13th rib. The exposed ribeye cross-section is measured for:
- **Marbling score** (1–10): intramuscular fat visible as white streaks — this is the #1 factor
- **Ribeye area** (sq inches): determines yield — 11–16 sq in typical
- **Fat cover** (mm): external fat depth over ribeye
- **Maturity** (A–E scale): from skeletal ossification
- **Color**: cherry red = fresh, dark = DFD (stress), brown = oxidation

**Grade outcome:**
- **AAA / Prime**: marbling score 8+, A–B maturity
- **AA / Choice**: marbling score 5–7
- **A / Select**: marbling score 2–4
- Standard/Commercial: remainder

### The AI Model Architecture

```
Camera array (3–5 angles)
        ↓
Preprocessing (resize 512×512, normalize, white balance)
        ↓
EfficientNet-B5 backbone (pre-trained on ImageNet)
        ↓
Multi-task heads:
  ├── Marbling regression head → score 1.0–10.0
  ├── Ribeye area regression head → sq inches
  ├── Fat cover regression head → mm
  └── Grade classification head → [A, AA, AAA]
        ↓
Confidence score output (reject if <0.75 confidence → manual fallback)
        ↓
Result stored in PostgreSQL via Prisma → displayed in React
```

**Framework:** PyTorch + Torchvision (separate Python microservice, not inside Node.js)
**Inference served via:** FastAPI (Python) → called from your Fastify API via HTTP/gRPC
**Model size:** ~28MB (EfficientNet-B5 quantized) → fits on Jetson Orin VRAM

### Training Data Requirements

| Source | Images | Cost | Notes |
|--------|--------|------|-------|
| Your own plant (best) | 500–1,000 paired with USDA grade | Free (time) | Tuned to your lighting/camera |
| USDA FSIS reference images | ~1,000 | Free (public domain) | Baseline |
| Scale AI labeling service | Any volume | $2–5/image | Use certified graders to label |
| Synthetic (GAN-generated) | Unlimited | $5–10K compute | Domain gap risk |
| **Minimum viable dataset** | **5,000 labeled images** | **$10–25K** | Achieves ~92% grade accuracy |

**Labeling rule:** Always use USDA-certified graders or CFIA inspectors to label — not crowd workers.

### Hardware Per Grading Station

```
3× industrial RGB cameras (IDS or Basler, 8MP, IP67 sealed)  → $9,000
1× NVIDIA Jetson AGX Orin (72 TOPS inference)                → $2,000
1× LED lighting array (5500K, stable color temp)             → $2,000
Stainless steel mounting, cables, switch                     → $1,500
─────────────────────────────────────────────────────────────────────
Total per grading station:                                    ~$14,500
```

Optional upgrades:
- NIR hyperspectral sensor (detects marbling under fat cap): +$120,000
- 3D depth sensor (precise ribeye area): +$25,000

### Regulatory Reality

⚠️ **USDA/CFIA does NOT yet accept AI grading as legally official.** A human inspector must still stamp the carcass. Your AI output is "informational" — used to:
- Pre-sort carcasses before inspector arrives (saves inspector time)
- Predict grade for pricing before official stamp
- Flag mismatches (AI says AAA, inspector says AA → retrain signal)
- Build the case for regulatory approval in 2–3 years as accuracy accumulates

---

## LAYER 2: Predictive Models

### 2a. Yield Prediction (XGBoost)

**What it predicts:** Given a carcass's HCW + grade + genetics → predict primal cut yields before fabrication

```python
Features:
  - Hot Carcass Weight (HCW in kg)
  - Grade (A/AA/AAA encoded)
  - Marbling score (1–10)
  - Fat cover (mm)
  - Animal age (months, from intake)
  - Breed (Angus, Hereford, etc.)

Targets:
  - Chuck yield % 
  - Rib yield %
  - Loin yield %
  - Round yield %
  - Brisket yield %

Model: XGBoost regressor (one per cut type)
Training data needed: 10,000+ historical carcass records (6–12 months of plant data)
Accuracy target: ±2–3% yield prediction
Business impact: Better cut decisions → $150–300/carcass revenue uplift
```

### 2b. HACCP Anomaly Detection (Isolation Forest)

**What it monitors:** Temperature logs, bleed times, pH readings — flags when something is outside safe ranges

```python
Input: Time-series of HACCP CCP measurements
Model: Isolation Forest (no labels needed — unsupervised)
Alert threshold: anomaly_score > 0.7
Output:
  - isAnomaly: boolean
  - anomalyScore: 0–1
  - reason: "temp 6.2°C exceeds 4°C limit in cooler 2"
  
Integration: Sends alert to OPS_MANAGER role via your existing notification system
```

### 2c. Demand Forecasting (Prophet)

**What it predicts:** Which cuts customers will order next week → optimize fabrication plan

```
Input: 18+ months of order history + seasonality + holidays
Output: Units by SKU for next 7 days
Accuracy target: MAPE < 12%
Value: Reduces spoilage 2–4% (saves $50–150K/year at medium plant)
```

---

## LAYER 3: Domain LLM (Claude + RAG)

### Why You Already Have What You Need

Your codebase already has `@anthropic-ai/sdk` installed. You don't need a separate LLM — you need to wire Claude to your domain data.

### What "Domain LLM" Actually Means for You

**NOT** training a new model. **YES** to:
1. **RAG** — Feed Claude your plant's documents as context
2. **Tool calling** — Let Claude query your Prisma database in real-time
3. **Fine-tuning (later)** — Once you have 10K+ Q&A pairs from real usage

### Data to Feed Into the RAG Layer

| Document Type | Source | Covers |
|---------------|--------|--------|
| CFIA inspection SOPs | cfia-acia.agr.gc.ca (free PDF) | Inspection procedures |
| USDA beef grading standards | USDA FSIS (free PDF) | Grading rules |
| HACCP 7-step framework | FDA/CFIA (free PDF) | Food safety |
| Your cut sheets | Internal | Primal → sub-primal mappings |
| Yield tables by breed | Internal (build over time) | Expected yields |
| Your facility SOPs | Internal | Company-specific rules |
| Historical grading data | Export from your Prisma DB | Benchmarks |

### Architecture

```
User question: "What's the expected ribeye yield for a 900lb Angus carcass graded AA?"
        ↓
Vector search → Supabase pgvector (already have Supabase!)
        ↓
Find: USDA yield tables + your historical Angus data
        ↓
Claude (claude-sonnet-4-6 via existing SDK) gets:
  - The question
  - 3–5 relevant document chunks
  - Live DB query result (recent Angus carcasses from your plant)
        ↓
Answer: "Based on your last 60 Angus carcasses graded AA, average ribeye yield 
        was 13.2 sq in with 22.4% rib primal yield. USDA tables suggest 21–24% 
        for this weight range."
```

**Supabase pgvector** — you already use Supabase, just enable the `vector` extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE documents ADD COLUMN embedding vector(1536);
```

Then embed documents with `text-embedding-3-small` (OpenAI, $0.02/1M tokens) or Claude's embeddings.

---

## Full System Architecture

```
┌─────────────────────── Plant Floor ──────────────────────┐
│                                                          │
│  RFID Reader ──→ Intake Station (tablet)                │
│                        ↓                                │
│  Camera Array ──→ Jetson Orin (Edge Inference)          │
│                        ↓                                │
│  Temp Sensors ──→ IoT Gateway (Raspberry Pi)            │
│                        ↓ (LAN)                          │
└──────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────── Your API Layer ───────────────────────┐
│  Fastify + tRPC (already built)                          │
│  ├── Animal router (Phase 1, to build)                  │
│  ├── Carcass router + grading jobs (Phase 2, to build)  │
│  ├── HACCP anomaly router (Phase 2, to build)           │
│  └── AI assistant router (can build now, Claude ready)  │
└──────────────────────────────────────────────────────────┘
                    ↓          ↓
          ┌──────────┐    ┌──────────────┐
          │ Supabase │    │  Python ML   │
          │ Postgres │    │  Microservice│
          │ pgvector │    │  (FastAPI)   │
          └──────────┘    └──────────────┘
                               ↓
                        ┌──────────────┐
                        │ AWS S3       │
                        │ (carcass     │
                        │  images)     │
                        └──────────────┘
```

---

## Cost Breakdown

### One-Time Build Costs

| Item | Cost | Notes |
|------|------|-------|
| CV grading hardware (medium plant, 1 station) | $14,500 | Camera + Jetson + lighting |
| RFID readers (3 panel, intake) | $8,000 | Animal tracking at lairage |
| Temp sensors + IoT gateway | $2,000 | HACCP monitoring |
| Camera labeling (5,000 images) | $15,000 | Hire CFIA-certified grader |
| ML model training (CV grading) | $3,000–8,000 | AWS SageMaker GPU hours |
| Python ML microservice dev | $20,000–40,000 | 1 ML engineer, 2–3 months |
| RAG setup (pgvector + document ingestion) | $5,000–10,000 | 3–4 weeks dev |
| Domain LLM assistant UI | $5,000–10,000 | 2–3 weeks frontend dev |
| **Total initial investment** | **$72,500–107,500** | Medium plant, 1 facility |

### Monthly Operating Costs

| Item | Small Plant | Medium Plant | Large Plant |
|------|------------|-------------|------------|
| Cloud inference (AWS/GCP) | $200–500 | $800–2,000 | $3,000–8,000 |
| Claude API (RAG assistant) | $50–200 | $200–500 | $500–2,000 |
| Supabase (pgvector storage) | $25–100 | $100–300 | $300–1,000 |
| Model retraining (monthly) | $100–300 | $300–800 | $800–2,000 |
| **Total monthly OpEx** | **$375–1,100** | **$1,400–3,600** | **$4,600–13,000** |

### ROI (Medium Plant, 500 cattle/day, 250 days/year = 125,000 cattle/year)

| Revenue Driver | Annual Value |
|----------------|-------------|
| Better grade detection (find hidden Prime) | +$187,500 |
| Yield optimization (+2% via predictive cuts) | +$375,000 |
| Waste reduction (contamination detection) | +$62,500 |
| Spoilage reduction (temp anomaly alerts) | +$50,000 |
| **Total annual uplift** | **$675,000** |
| Annual OpEx | $25,000 |
| **Net annual value** | **$650,000** |
| **Payback on $90K investment** | **~7 weeks** |

---

## Phased Build Roadmap

### Phase 0 — Now (0 Cost, 2–4 Weeks)
**Build the RAG assistant using existing Claude SDK:**
- Enable pgvector on Supabase (`CREATE EXTENSION vector`)
- Ingest CFIA + USDA PDFs into vector DB (use `text-embedding-3-small`)
- Wire Claude to answer questions using your existing `Animal`, `BinCycle`, `Employee` data
- Add `/ai-assistant` route in tRPC
- Build simple chat UI in React

**Deliverable:** "Ask your plant" AI assistant that knows CFIA rules + your data. Zero hardware needed.

### Phase 1 — Months 1–3 ($8,000–15,000)
**Animal Intake + Traceability:**
- Implement `Animal` + `LotBatch` + `SlaughterRecord` models from arch.md Phase 1
- Add RFID reader integration at lairage (panel readers)
- CFIA/NLIS database lookup on EID scan
- Voice health notes (existing `farmer.service.ts` pattern)

**Deliverable:** Full animal traceability from farm → floor.

### Phase 2 — Months 4–6 ($50,000–80,000)
**Computer Vision Grading Pilot:**
- Set up cameras at 12th-rib split station at partner plant
- Collect 1,000 labeled carcass images (paired with CFIA inspector grades)
- Fine-tune EfficientNet-B5 on plant-specific data
- Deploy inference on Jetson Orin (edge)
- Build `CarcassGradingResult` Prisma model
- tRPC `submitForAIGrading` + `getGradingResult` endpoints
- React grading review UI (accept/reject AI grade)

**Deliverable:** AI grading at single station, validated against CFIA inspector. ~90% accuracy.

### Phase 3 — Months 7–9 ($80,000–120,000)
**Full Pipeline + HACCP Intelligence:**
- Stages 2–8 schema + routers (from arch.md Phase 2–3)
- Temperature sensor integration (IoT gateway → Prisma)
- HACCP anomaly detection (Isolation Forest on CCP logs)
- Yield prediction model (XGBoost, train on Phase 1–2 data accumulation)
- Fabrication workstation contamination detection
- Recall trace UI (backward/forward via LotBatch graph)

**Deliverable:** All 11 stages covered, HACCP automated, recall in <2 minutes.

### Phase 4 — Months 10–12 ($50,000–80,000)
**Scale + Predictive Intelligence:**
- Multi-facility SaaS (different plants, federated Prisma schema)
- Demand forecasting (Prophet) → daily fabrication plan
- Lot-level blockchain anchoring (Cardano NFT per lot, not just daily)
- Per-animal blockchain trace (premium feature for export markets)
- Model retraining pipeline (MLflow + Airflow/Prefect)

**Deliverable:** Multi-tenant SaaS platform, models improve continuously with more plant data.

---

## Technology Decisions

### What to Use for Computer Vision (Python Microservice)
```
Training: PyTorch + torchvision + timm (EfficientNet models)
Serving:  FastAPI + TorchServe (or ONNX Runtime for Jetson)
Edge:     NVIDIA Jetson AGX Orin + TensorRT (quantized model)
Images:   AWS S3 (pre-signed upload URLs from your tRPC API)
Queue:    Redis (job queue for async grading)
Tracking: MLflow (model versioning + experiment tracking)
```

### What NOT to Do
- ❌ Don't try to run PyTorch models inside Node.js — use a Python FastAPI sidecar
- ❌ Don't replace CFIA/USDA inspectors — position AI as "AI-assisted grading" (regulatory requirement)
- ❌ Don't train from scratch — fine-tune EfficientNet (10x cheaper, same accuracy)
- ❌ Don't pay Frontmatec $350K/station — build your own CV for $15K/station
- ❌ Don't build a separate LLM — use Claude via RAG (you already have the SDK)

### Where to Deploy
| Component | Deploy Where | Why |
|-----------|-------------|-----|
| React app | Netlify (existing) | Already there |
| Fastify API | Render (existing) | Already there |
| PostgreSQL | Supabase (existing) | Already there |
| CV inference (real-time) | Jetson Orin at plant (edge) | <200ms latency |
| CV model training | AWS SageMaker (cloud, on-demand) | Rent GPU only when retraining |
| Python ML microservice | AWS ECS or Render (cloud) | Stateless, scales |
| Carcass images | AWS S3 | Cheap, durable, pre-signed URLs |

---

## Competitive Position

| Company | Stage Coverage | AI | Price | Your Advantage |
|---------|---------------|-----|-------|---------------|
| Inecta | All 11 | Basic | $200K+/year | Modern stack, 10x cheaper |
| Volur.ai | Stages 3–4 | CV grading | $150K/year | Full platform, blockchain |
| Frontmatec | Stage 4 only | CV grading | $350K/station | 24x cheaper per station |
| **Your platform** | **All 11** | **CV + LLM + Predictive** | **$500–3K/month** | **Only full-stack + blockchain** |

**Unique moats:**
1. **Cardano blockchain anchoring** — immutable audit trail (export market differentiator)
2. **Stage 9 by-products** — no competitor covers organ tracking with DK compliance
3. **Full 11-stage ERP** — competitors are single-stage point solutions
4. **Cost structure** — custom CV at $14.5K vs. $350K from Frontmatec

---

## Next Immediate Actions

**This week (no hardware, no AI training):**
1. Enable `pgvector` extension on Supabase
2. Write a document ingestion script to embed CFIA + USDA PDFs
3. Add `aiAssistant` tRPC router (one endpoint: `chat`)
4. Build a simple chat widget in React sidebar
5. Connect to Claude via existing `@anthropic-ai/sdk`

**This gives you a working domain LLM in ~1 week, zero extra cost.**

**Next month:**
1. Source 3 industrial cameras (IDS or Basler, $3K each)
2. Order 1× Jetson AGX Orin ($2K)
3. Partner with 1 slaughter facility to mount cameras at grading station
4. Start collecting carcass images + pairing with inspector grades
5. Set up AWS S3 bucket + SageMaker training job template
