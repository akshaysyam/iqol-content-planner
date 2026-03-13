# Content Quality Tracker (Internal Tool)

An internal content management and quality assurance platform built to streamline the blog creation lifecycle for **Canvas Homes** and **Vault Proptech**. 

This system handles end-to-end content operations: from data-driven keyword planning and task assignment to automated QA checks, legal compliance, and performance tracking.

## 🚀 Tech Stack

* **Frontend:** Next.js (App Router), React, Tailwind CSS
* **Backend/Database:** Firebase Authentication, Cloud Firestore
* **Language:** TypeScript

## 👥 Role-Based Access Control (RBAC)

The platform is strictly segregated by user roles to ensure data privacy and workflow integrity:

* **Platform Admin:** Unrestricted access across all brands. Manages global settings, keyword pools, and high-level performance dashboards.
* **Content Manager:** Brand-specific admin. Creates topics, assigns tasks to writers/lawyers, manages SEO finalization, and pushes to CMS.
* **Content Writer:** Execution layer. Accesses a dedicated dashboard to view assigned topics, target keywords, word counts, and writes content within the Rich Text Editor.
* **Lawyer:** Compliance layer. Reviews system-approved blogs for legal accuracy, with the ability to approve or request revisions.

## ✨ Core Features (Roadmap & Current State)

- [x] **Secure Authentication:** Role-based login routing users to their specific dashboards.
- [x] **Keyword Pool Management:** Database for tracking targeted keywords, search volume, keyword difficulty (KD), intent, and trends.
- [x] **Smart Topic Assignment:** Managers can create topics, link target keywords, and assign writers and legal reviewers based on brand access.
- [ ] **Writer Dashboard & Editor:** Dedicated workspace with guidelines and rich text formatting.
- [ ] **Automated QA Engine:** Pre-submission validation checking AI percentage (<40%), meta keyword matching (>90%), and word count limits.
- [ ] **Legal Verification Loop:** Dashboard for legal teams to approve or reject content.
- [ ] **CMS Integration & SEO Finalization:** Final pass for meta titles/descriptions and internal linking.
- [ ] **Performance Analytics:** High-level dashboard tracking impressions, CTR, and traffic sources.

## 🛠️ Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### 1. Clone the repository
\`\`\`bash
git clone <your-repo-url>
cd content-quality-tracker
\`\`\`

### 2. Install dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Variables
Create a `.env.local` file in the root directory and add your Firebase configuration details:

\`\`\`env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
\`\`\`

### 4. Run the development server
\`\`\`bash
npm run dev
\`\`\`
Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## 🗄️ Database Structure (Firestore)

* `users/`: Stores user profiles, emails, roles (`Platform Admin`, `Content Manager`, etc.), and assigned `brands` array.
* `keywords/`: Central pool of target keywords and SEO metrics.
* `topics/`: The core operational tasks linking a brand, keyword, writer, lawyer, and status.

---
*Built for IQOL.*
