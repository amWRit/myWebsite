/*
Copyright (c) 2011 Sam Phippen <samphippen@googlemail.com>
Copyright (c) 2026 Amrit Puri

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
var profileElement = document.getElementById("profile");
var cursorElement = document.querySelector("#console .cursor");
var fileNameElement = document.getElementById("profile-file");
var isTerminalPage = document.body.dataset.terminal !== "false";

function loadMarkdownParser() {
  return new Promise(function(resolve, reject) {
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js";
    script.onload = function() {
      if (typeof window.markdownit !== "function") {
        reject(new Error("Markdown parser did not load"));
        return;
      }
      resolve(window.markdownit({ html: false }));
    };
    script.onerror = function() {
      reject(new Error("Markdown parser request failed"));
    };
    document.head.appendChild(script);
  });
}

var Typer = {
  speed: 2,
  baseDelay: 45,
  delayJitter: 25,
  file: document.body.dataset.profile || "profile.md",
  nodes: [],
  nodeIndex: 0,
  nodeOffset: 0,
  timer: null,
  init: function() {
    fileNameElement.textContent = this.file;
    document.title = this.file === "portfolio.md" ? "Portfolio | amWRit" : "amWRit";

    Promise.all([
      fetch(this.file).then(function(response) {
        if (!response.ok) {
          throw new Error("Profile request failed");
        }
        return response.text();
      }),
      loadMarkdownParser()
    ]).then(function(results) {
      profileElement.innerHTML = results[1].render(results[0]);
      Typer.structureDisclosures();

      if (!isTerminalPage) {
        Typer.showAll();
        if (cursorElement) {
          cursorElement.remove();
        }
        return;
      }

      Typer.prepareTextNodes();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        Typer.showAll();
        return;
      }
      Typer.scheduleNext();
    }).catch(function() {
      profileElement.textContent = "Unable to load the page. ";
      var link = document.createElement("a");
      link.href = Typer.file;
      link.textContent = "Open the Markdown file";
      profileElement.appendChild(link);
    });
  },
  structureDisclosures: function() {
    [
      "SELECTED WORK",
      "PROFESSIONAL EXPERIENCE",
      "EDUCATION",
      "TECHNICAL SKILLS",
      "CERTIFICATIONS & RECOGNITION",
      "TALKS & WORKSHOPS"
    ].forEach(function(sectionTitle) {
      var sectionHeading = Array.from(profileElement.querySelectorAll("h2")).find(function(heading) {
        return heading.textContent.trim() === sectionTitle;
      });

      if (!sectionHeading) {
        return;
      }

      var node = sectionHeading.nextElementSibling;
      var disclosure = null;

      while (node && node.tagName !== "H2") {
        var nextNode = node.nextElementSibling;

        if (node.tagName === "H3") {
          disclosure = document.createElement("details");
          disclosure.className = "portfolio-entry";
          var summary = document.createElement("summary");
          while (node.firstChild) {
            summary.appendChild(node.firstChild);
          }
          disclosure.appendChild(summary);
          profileElement.insertBefore(disclosure, node);
          node.remove();
        } else if (disclosure) {
          disclosure.appendChild(node);
        }

        node = nextNode;
      }
    });
  },
  prepareTextNodes: function() {
    var walker = document.createTreeWalker(profileElement, NodeFilter.SHOW_TEXT);
    var node;

    while ((node = walker.nextNode())) {
      var details = node.parentElement.closest("details");
      if (details && !node.parentElement.closest("summary")) {
        continue;
      }

      this.nodes.push({ node: node, text: node.nodeValue });
      node.nodeValue = "";
    }
  },
  typeNext: function() {
    var remaining = this.speed;
    var pause = 0;

    while (remaining > 0 && this.nodeIndex < this.nodes.length) {
      var entry = this.nodes[this.nodeIndex];
      var available = entry.text.length - this.nodeOffset;

      if (available === 0) {
        this.nodeIndex++;
        this.nodeOffset = 0;
        continue;
      }

      var count = Math.min(remaining, available);
      var addedText = entry.text.substring(this.nodeOffset, this.nodeOffset + count);
      this.nodeOffset += count;
      entry.node.nodeValue = entry.text.substring(0, this.nodeOffset);
      remaining -= count;
      entry.node.parentNode.insertBefore(cursorElement, entry.node.nextSibling);

      var listItem = entry.node.parentElement.closest("li");
      if (listItem) {
        listItem.classList.add("is-started");
        listItem.closest("ul, ol").classList.add("is-started");
      }

      var summary = entry.node.parentElement.closest("summary");
      if (summary) {
        summary.parentElement.classList.add("is-started");
      }

      if (/[.!?]/.test(addedText)) {
        pause = 280;
      } else if (/[,;:]/.test(addedText)) {
        pause = Math.max(pause, 110);
      }

      if (this.nodeOffset === entry.text.length) {
        this.nodeIndex++;
        this.nodeOffset = 0;
      }
    }

    this.followCursor();

    if (this.nodeIndex === this.nodes.length) {
      window.clearTimeout(this.timer);
      this.startNextLine();
    } else {
      this.scheduleNext(pause);
    }
  },
  scheduleNext: function(pause) {
    var delay = pause || this.baseDelay + Math.floor(Math.random() * this.delayJitter);
    this.timer = window.setTimeout(function() {
      Typer.typeNext();
    }, delay);
  },
  followCursor: function() {
    var cursorBottom = cursorElement.getBoundingClientRect().bottom;
    var bottomMargin = 72;

    if (cursorBottom > window.innerHeight - bottomMargin) {
      window.scrollBy(0, cursorBottom - window.innerHeight + bottomMargin);
    }
  },
  startNextLine: function() {
    cursorElement.parentNode.insertBefore(document.createElement("br"), cursorElement);
    this.followCursor();
  },
  showAll: function() {
    profileElement.querySelectorAll("details").forEach(function(disclosure) {
      disclosure.classList.add("is-started");
    });
    profileElement.querySelectorAll("ul, ol").forEach(function(list) {
      list.classList.add("is-started");
    });
    profileElement.querySelectorAll("li").forEach(function(item) {
      item.classList.add("is-started");
    });

    this.nodes.forEach(function(entry) {
      entry.node.nodeValue = entry.text;
    });

    if (this.nodes.length) {
      var lastNode = this.nodes[this.nodes.length - 1].node;
      lastNode.parentNode.insertBefore(cursorElement, lastNode.nextSibling);
      this.startNextLine();
    }
  }
};

Typer.init();
