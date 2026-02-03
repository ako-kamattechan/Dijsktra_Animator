# Interactive Dijkstra Visualizer

![License](https://img.shields.io/badge/license-MIT-yellow.svg)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=flat&logo=javascript&logoColor=%23F7DF1E)
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=flat&logo=css3&logoColor=white)
![Status](https://img.shields.io/badge/status-educational-blue)

## Security Warning
**Please Read Before Deploying**

This application was developed for educational purposes and is intended for **local use only**.

- **Vulnerability:** The application does not strictly sanitize user inputs (specifically Node IDs and JSON imports) before rendering them to the DOM.
- **Risk:** It is vulnerable to **Cross-Site Scripting (XSS)**. Loading a malicious JSON preset or creating a node with crafted HTML/JavaScript as its ID can execute arbitrary code in the browser.
- **Recommendation:** Do not host this on a public-facing web server where untrusted users can share links or presets, unless you implement a sanitation library (like DOMPurify) for the data table rendering.

# Interactive Dijkstra Visualizer

A lightweight, vanilla JavaScript engine for visualizing graph pathfinding algorithms (specifically Dijkstra's Algorithm). Built with raw SVG for rendering and CSS3 for the interface.

##  Features
- **Interactive Graph Editor:** Click to add nodes, drag to connect edges.
- **Visual Algorithm Execution:** Watch Dijkstra's algorithm explore nodes in real-time.
- **Dynamic Distance Table:** See the calculation table update as the algorithm progresses.
- **JSON Presets:** Save and load your graph structures using JSON.
- **Focus Mode:** A minimal UI mode for presentations or embedding.
- **Responsive Design:** Includes a collapsible sidebar and resizable layout.

Iframe Integration
This project includes a message handshake protocol (window.postMessage) allowing it to be embedded in LMS (Learning Management Systems) or other parent windows. It supports commands like INIT_GRAPH, START, STOP, and FOCUS_MODE.

##  Controls

| Action | Input |
| :--- | :--- |
| **Create Node** | Click on empty space |
| **Create Edge** | Click a node, drag to another node |
| **Move Node** | `Ctrl` + Drag Node |
| **Edit Weights** | Double click an Edge |
| **Delete** | `Shift` + Click Node or Edge |
| **Cancel/Back** | `Esc` key |

## Tech Stack
- **Core:** Vanilla JavaScript (ES6+)
- **Rendering:** HTML5 SVG (Scalable Vector Graphics)
- **Styling:** CSS3 (Variables, Glassmorphism, Grid Animations)
- **No Dependencies:** No frameworks, no build steps required.

## Usage
Simply clone the repository and open `index.html` in your browser.

```bash
git clone [https://github.com/YOUR_USERNAME/REPO_NAME.git](https://github.com/YOUR_USERNAME/REPO_NAME.git)
cd REPO_NAME
# Open index.html
```
## License

MIT License. see LICENSE.
