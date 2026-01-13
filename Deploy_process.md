# 🚀 Zero‑Cost Demo Deployment Guide

> **Goal:** Anyone should be able to deploy a Node.js app on AWS using **GitHub Actions + Terraform**, demo it, and then **destroy everything** so that **no cost remains**.

This document is **self‑contained**. If you follow it step‑by‑step, you **do not need to search anywhere else**.

---

## 🧠 Core Philosophy (Very Important)

* **Code is permanent** (GitHub)
* **Infrastructure is temporary** (Terraform)
* **Servers are disposable**
* **No SSH manually in production mindset**

This is how real engineers do demos, PoCs, and even production.

---

## 🏗️ Final Architecture

```
Git Push
   ↓
GitHub Actions (CI/CD)
   ↓
Terraform (Infra as Code)
   ↓
EC2 (Docker installed via User‑Data)
   ↓
Docker Container (Node.js app)
```

When demo is over:

```
terraform destroy  →  💰 cost stops completely
```

---

## 📦 Prerequisites (One‑Time Setup)

### 1️⃣ AWS Account

* Create an **IAM user** (not root)
* Permissions:

  * EC2
  * VPC
  * Security Groups

### 2️⃣ Local Tools

```bash
sudo apt install git docker terraform awscli -y
aws configure
```

---

## 📁 Project Structure

```
project-root/
 ├── src/
 │    └── index.js
 ├── package.json
 ├── Dockerfile
 ├── .gitignore
 ├── infra/
 │    ├── main.tf
 │    ├── outputs.tf
 └── .github/
      └── workflows/
           └── deploy.yml
```

---

## 🟢 Step 1 — Node.js App

### `src/index.js`

```js
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Deployment successful 🚀");
});

app.listen(3000, () => console.log("App running on port 3000"));
```

---

## 🟢 Step 2 — Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

Why Docker?

* Same runtime everywhere
* No manual Node install

---

## 🟢 Step 3 — `.gitignore` (CRITICAL)

```gitignore
node_modules/
.env
*.log
```

⚠️ **Never commit `node_modules`**

---

## 🟢 Step 4 — Terraform (EC2 + Security Group)

### `infra/main.tf`

```hcl
provider "aws" {
  region = "ap-south-1"
}

resource "aws_security_group" "app_sg" {
  name = "demo-sg"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "app" {
  ami           = "ami-0f5ee92e2d63afc18"  # Ubuntu 22.04
  instance_type = "t3.micro"
  security_groups = [aws_security_group.app_sg.name]

  user_data = <<-EOF
    #!/bin/bash
    apt update -y
    apt install docker.io -y
    systemctl start docker
    usermod -aG docker ubuntu
  EOF

  tags = {
    Name = "demo-app"
  }
}
```

### `infra/outputs.tf`

```hcl
output "ec2_ip" {
  value = aws_instance.app.public_ip
}
```

---

## 🟢 Step 5 — Create Infra

```bash
cd infra
terraform init
terraform apply
```

Save the **public IP**.

---

## 🔐 Step 6 — SSH Key & Base64 (IMPORTANT PART)

### Why Base64 is needed?

GitHub Secrets **break multiline values** like SSH keys.

### Convert private key to base64

```bash
base64 ~/.ssh/id_ed25519 | tr -d '\n'
```

### GitHub Secrets

| Name     | Value                          |
| -------- | ------------------------------ |
| EC2_HOST | EC2 public IP                  |
| EC2_KEY  | **base64 encoded private key** |

---

## 🟢 Step 7 — GitHub Actions Workflow

### `.github/workflows/deploy.yml`

```yaml
name: Deploy App

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Decode SSH key
        run: |
          echo "${{ secrets.EC2_KEY }}" | base64 -d > key.pem
          chmod 600 key.pem

      - name: Build Docker image
        run: docker build -t demo-app .

      - name: Save image
        run: docker save demo-app > app.tar

      - name: Copy image to EC2
        run: |
          scp -i key.pem -o StrictHostKeyChecking=no app.tar ubuntu@${{ secrets.EC2_HOST }}:/home/ubuntu

      - name: Run container
        run: |
          ssh -i key.pem ubuntu@${{ secrets.EC2_HOST }} << 'EOF'
            docker load < app.tar
            docker stop demo || true
            docker rm demo || true
            docker run -d -p 80:3000 --name demo demo-app
          EOF
```

---

## ❌ Common Errors & Fixes

### ❌ Error: `Load key: invalid format`

**Reason:** Multiline SSH key broken in GitHub secrets

✅ **Fix:** Always base64 encode key

---

### ❌ Error: `permission denied (publickey)`

**Reasons:**

* Wrong EC2 user (`ubuntu` vs `ec2-user`)
* Key not added to instance

---

### ❌ Error: `docker: command not found`

**Reason:** Docker not installed

✅ **Fix:** Ensure user-data script exists

---

## 🚀 Demo Flow (What You Show Someone)

```bash
terraform apply
git push origin main
```

Open browser:

```
http://EC2_IP
```

---

## 💣 Destroy Everything (MOST IMPORTANT)

```bash
terraform destroy
```

✅ EC2 deleted
✅ Security group deleted
✅ Cost = **₹0 after this**

---

## 💰 Cost Summary

| Resource       | Cost               |
| -------------- | ------------------ |
| EC2            | Only while running |
| Terraform      | Free               |
| GitHub Actions | Free tier          |
| Idle infra     | ₹0                 |

---

## 🧠 Final Golden Rules

* Infra should be **re-creatable in minutes**
* If destroy scares you → automation missing
* Never manually SSH for deployments

---

## 🟣 NEXT STEP — DATABASE INTEGRATION (PostgreSQL & MongoDB Atlas)

This section extends the same **deploy → demo → destroy** philosophy to databases.

---

## 🐘 Option A — PostgreSQL (AWS RDS) [Real Production Feel]

### When to use

* You want to show **real backend + SQL skills**
* Interviews / serious demos
* Relations, joins, transactions

### Core Principle (IMPORTANT)

> **Never keep RDS running when demo is over**

RDS charges even when stopped.

Correct flow:

```
Create RDS → Use → Snapshot → Delete
Restore snapshot → Use → Delete again
```

---

## 🧩 PostgreSQL Integration Architecture

```
Node.js App (EC2 / ECS)
   |
   | DATABASE_URL
   v
RDS PostgreSQL
```

---

## 🟢 Step 1 — Create RDS (Terraform)

Add this inside `infra/main.tf`:

```hcl
resource "aws_db_instance" "postgres" {
  allocated_storage    = 20
  engine               = "postgres"
  engine_version       = "15"
  instance_class       = "db.t3.micro"
  db_name              = "demo"
  username             = "postgres"
  password             = "postgres123"
  skip_final_snapshot  = true
  publicly_accessible  = true
}
```

⚠️ For demo only — credentials must be secret in real systems.

---

## 🟢 Step 2 — Get DB URL

After `terraform apply`:

```
postgresql://postgres:postgres123@RDS_ENDPOINT:5432/demo
```

---

## 🟢 Step 3 — Pass DB URL to App (ENV)

Modify GitHub Actions deploy step:

```bash
docker run -d \
  -e DATABASE_URL=postgresql://... \
  -p 80:3000 \
  --name demo demo-app
```

In Node.js:

```js
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
```

---

## 💣 Step 4 — Snapshot & Delete (MOST IMPORTANT)

After demo:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier demo \
  --db-snapshot-identifier demo-snap
```

Then:

```bash
terraform destroy
```

💰 Cost drops to **₹0**

---

## 🔄 Step 5 — Restore When Needed Again

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier demo \
  --db-snapshot-identifier demo-snap
```

---

## 🍃 Option B — MongoDB Atlas (EASIEST & CHEAPEST)

### Your assumption is CORRECT ✅

> MongoDB Atlas already gives a **ready DB URL**

No infra setup needed.

---

## 🟢 MongoDB Atlas Integration Steps

1️⃣ Create free cluster (M0)
2️⃣ Get connection string

```
mongodb+srv://user:pass@cluster.mongodb.net/db
```

3️⃣ Add to GitHub Secrets

```
MONGODB_URI
```

4️⃣ Use in CI/CD

```bash
-e MONGODB_URI=${{ secrets.MONGODB_URI }}
```

5️⃣ Use in Node.js

```js
mongoose.connect(process.env.MONGODB_URI);
```

---

## ⚖️ PostgreSQL vs MongoDB Atlas (Demo Perspective)

| Feature             | PostgreSQL (RDS)     | MongoDB Atlas |
| ------------------- | -------------------- | ------------- |
| Infra setup         | Needed               | ❌ None        |
| Cost risk           | ⚠️ High if forgotten | ✅ Free tier   |
| Real backend signal | ⭐⭐⭐⭐⭐                | ⭐⭐⭐           |
| Demo speed          | Slower               | Fast          |

---

## 🧠 Senior Engineer Advice

* **Quick demo / portfolio** → MongoDB Atlas
* **Interview / system design** → PostgreSQL RDS

---

## 🧠 Golden Database Rule

> If DB is running after demo → you will pay.

Always snapshot + delete.

---

## 🚀 Next Possible Extensions

* PostgreSQL via Docker (zero AWS DB cost)
* RDS + Secrets Manager
* ECS + RDS
* DB migrations (Prisma / Flyway)

---

* Move EC2 → ECS
* Add RDS snapshot restore
* Add staging vs prod
* Add secrets manager

---

✅ **If you master this document, you already think like a senior backend engineer.**
