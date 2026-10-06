
Full Stack Developer Task - 2026 

Press Mentions Monitoring & Dashboard for Portfolio Companies 
1. Overview 
OurCrowd tracks press coverage of its portfolio and fund companies. Design and build a small system  that monitors news coverage for a given list of companies, classifies each mention's sentiment, and  presents the results through a dashboard - with a daily alert when new coverage appears.  
We are less interested in a "perfect" product than in how you approach the problem: your architecture  choices, code quality, use of the required local LLM, and the clarity of your documentation.  
2. Goals 
1. Quarterly press dashboard: Build a dashboard showing, for each OurCrowd portfolio/fund  company, its press appearances over the last quarter. Each mention should be classified as  positive, negative, or neutral, and linked back to its source (a reference / URL to the original  article).  
2. Current mention status: For each company, surface its current "mention status" based on the date  it was last mentioned in the news (e.g. last mentioned 3 days ago / 45 days ago / no coverage  found).  
3. Daily alert: Implement a daily job that checks for new press mentions of any tracked company and  sends an alert when one is found.  
3. Data Provided 
You will be given a list of OurCrowd portfolio companies and fund companies (name + any identifying  detail such as domain or sector) to use as the seed list for monitoring. This list will be shared with you  separately alongside this document.  
• Use this list as the source of truth for which companies to track.  
• You are free to decide how to source news for each company (e.g. news/search APIs, RSS,  scraping). Please document your choice and its limitations in the README.  
4. Technical Requirements 
4.1 Local LLM (required) 
Sentiment classification (and any other text understanding step, e.g. relevance filtering or  summarization) must run through a locally hosted Ollama model — not a cloud/hosted LLM API.  Please state in your README:  
• Which Ollama model you used and why.  
• How the model is invoked (prompt structure, expected output format).  
• How you validated classification quality (even informally, e.g. a small manual spot-check).  
4.2 Architecture 
The solution must be implemented in JavaScript (Node.js) for both backend and any data-collection  components. Beyond that, you're free to choose your own frameworks/libraries. 
As a guide, a solution typically includes:  
• A data-collection component that fetches recent news items per company.  • A classification step (Ollama) that labels each item's sentiment.  
• A storage layer (files or a lightweight database) holding results.  
• A dashboard/UI layer to visualize quarterly mentions and current status per company.  
• A scheduled job (cron, script, or workflow tool) that performs the daily check and sends the alert  (email, Slack, webhook, console/log output, etc. — your choice, just make it visible and  documented).  
5. Deliverables 
4. A GitHub repository containing your full solution, with a clear README that explains:  ◦ What the project does and how it's structured.  
◦ Setup instructions (dependencies, environment variables, how to install/run Ollama and which  model to pull).  
◦ Exact commands to run the project end-to-end, locally.  
◦ Any assumptions, trade-offs, or known limitations.  
5. A data folder containing the output of a successful run — e.g. the collected mentions, sentiment  labels, references/links, and the computed "last mentioned" status per company — so we can  review results without re-running everything ourselves.  
6. A copy of the full prompt used with AI coding assistants while building the solution.  
6. Evaluation Criteria 
• Correctness — the pipeline runs end-to-end and produces the three required outputs.  • Code quality — structure, readability, and reasonable error handling.  
• Use of the local LLM — sensible prompting and integration with Ollama.  
• Documentation — a reviewer unfamiliar with the project can set it up and run it from the README  alone.  
• Product thinking — sensible choices around sentiment classification, alerting, and how the  dashboard presents information.  
7. Notes 
• Feel free to make reasonable assumptions where this document is ambiguous, just document  them.  
• If you run out of time, a partially complete solution with clear notes on what's missing is preferred  over an undocumented "complete" one.  
• Please reach out if you have questions about the company list or scope.  
