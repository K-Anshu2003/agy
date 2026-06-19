# BigQuery Release Hub & Tweet Composer 🚀

A sleek, responsive, and modern web application built using **Python Flask** and vanilla **HTML, CSS, and JavaScript**. It fetches, parses, and formats Google's official BigQuery release notes and offers a feature-rich interface to compose, customize, and share updates directly to X/Twitter.

---

## 🎨 Design & Interface

- **Animated Mesh Background**: Interactive shifting radial gradients.
- **Glassmorphic Panels**: Semi-transparent content sections leveraging background blurs.
- **Micro-interactions**: Spin animations for refreshing, pulsing connection indicator status, and interactive progress ring indicators.
- **Responsive Layout**: Designed to work beautifully on mobile, tablet, and desktop viewports.

---

## ✨ Features

- **Live XML Feed Fetching**: Pulls notes directly from the official feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`).
- **5-Minute Caching**: Built-in backend caching to limit API queries and protect page speed.
- **Dynamic Search & Filtering**: Fast search bar (SQL, Gemini, partitioning, etc.) and category-based filtering (Features vs. Issues vs. Other).
- **Multi-Selection Compose**: Ability to select multiple update cards to draft a digest style post.
- **X/Twitter Composer Modal**:
  - Live character counter with an SVG progress ring.
  - Template selector (Standard vs. Summary style).
  - Quick hashtag shortcuts (`#BigQuery`, `#GoogleCloud`).
  - Seamless clipboard copying and X Web Intent integration.

---

## 📂 File Structure

```
agy-cli-projects/
│
├── app.py                # Python Flask server & XML parsing engine
├── templates/
│   └── index.html        # HTML skeleton
├── static/
│   ├── css/
│   │   └── styles.css    # Modern UI styles & transitions
│   └── js/
│       └── app.js        # JavaScript application state & handlers
├── .gitignore            # Git ignored files & folders
└── README.md             # Project documentation
```

---

## 🚀 Running the Project Locally

### 1. Install Dependencies
Ensure you have Python installed, then install Flask:
```bash
pip install Flask
```

### 2. Start the Server
Run the Flask server:
```bash
python app.py
```

### 3. Open the App
Navigate to:
[http://127.0.0.1:5000](http://127.0.0.1:5000)
