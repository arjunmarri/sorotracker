// Chrome service worker entry point. Firefox loads the same files via "background.scripts".
importScripts('../shared/config.js', '../shared/markdown.js', 'llm.js', 'secrets.js', 'background.js');
