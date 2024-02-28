// Enable experimental features to support multiple browser views in a single browser
process.env.ELECTRON_ENABLE_EXPERIMENTAL_FEATURES = true;

// Modules to control application life and create native browser window
const {
  app,
  shell,
  BrowserWindow,
  BrowserView,
  nativeTheme,
} = require("electron");
const crypto = require("node:crypto");
const axios = require("axios");
const cheerio = require("cheerio");

const urls = process.argv
  .slice(2)
  .map((url) =>
    url.startsWith("^") ? `^https://${url.slice(1)}` : `https://${url}`
  );
const uid = crypto
  .createHash("sha256")
  .update(urls.join("~").replaceAll(/\^/g, ""))
  .digest("hex");

const uaUrl = "https://useragents.me";
const uaQry = ".ua-textarea";
let ua;

const lightBg = "#f0f0f0";
const darkBg = "#121212";

let initDarkScript;
let wantsDark = urls.some((url) => url.startsWith("^"));
nativeTheme.themeSource = wantsDark ? "dark" : "light";

let mainWindow;
const views = [];

function createWindow(debug) {
  if (wantsDark && !initDarkScript) {
    wantsDark = false;
    return fetch("https://unpkg.com/darkreader/darkreader.js").then(
      (response) => {
        response.text().then((script) => {
          initDarkScript = `${script};DarkReader.enable();`;
        });
        return createWindow(debug);
      }
    );
  }
  if (!ua) {
    // Find a good user agent
    return axios.get(uaUrl).then((res) => {
      console.log(`ua status: ${res.status}`);
      const $ = cheerio.load(res.data);
      ua = $(uaQry)
        .filter((_, el) => $(el).text().includes("Chrome"))
        .first()
        .text();
      console.log(`user agent: ${ua}`);
      if (!ua) {
        throw new Error(`no user agent found`);
      }
      return createWindow(debug);
    });
  }
  return new Promise((resolve) => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
      fullscreen: true,
      backgroundColor: wantsDark ? darkBg : lightBg,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    // Build the browser views
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const dark = url.startsWith("^");
      const realUrl = dark ? url.substring(1) : url;
      const partition = `persist:${realUrl}~${uid}#${i}`;
      const view = new BrowserView({
        backgroundColor: dark ? darkBg : lightBg,
        webPreferences: {
          partition,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      view.webContents.userAgent = ua || view.webContents.getUserAgent();
      view.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
      });
      view.webContents.on("did-finish-load", () => {
        if (dark) {
          view.webContents.executeJavaScript(initDarkScript);
        }
        if (mainWindow.getBrowserViews().includes(view)) {
          return;
        }
        mainWindow.addBrowserView(view);
        if (debug) {
          console.log(`open devtools on partition ${partition}`);
          mainWindow.webContents.openDevTools();
          view.webContents.openDevTools();
        }
      });
      view.webContents.loadURL(realUrl);
      views.push(view);
      console.log(`spawned partition ${partition}`);
    }
    resolve();
  });
}

function reorientViews() {
  if (BrowserWindow.getAllWindows().length === 0) return;
  const [width, height] = mainWindow.getSize();
  console.log("screen", mainWindow.getSize());
  // use euler as slave width multiplier
  const slaveFact = Math.sqrt(3) / 2;
  console.log("slave fact", slaveFact);
  if (urls.length < 3) {
    // build up to 2 columns
    let x = 0;
    for (let i = 0; i < urls.length; i++) {
      const view = views[i];
      const w = Math.floor(width / urls.length);
      const b = {
        x,
        y: 0,
        width: w,
        height,
      };
      console.log(i, b);
      view.setBounds(b);
      x += w;
    }
  } else if (urls.length == 3) {
    // build 3 columns with larger center column (tower)
    let x = 0;
    for (let i = 0; i < urls.length; i++) {
      const view = views[i];
      let w = Math.floor((width / 3) * slaveFact);
      if (i == 2) {
        w = Math.ceil(width - 2 * w);
      }
      const b = {
        x,
        y: 0,
        width: w,
        height,
      };
      console.log(i, b);
      view.setBounds(b);
      x += w;
    }
  } else if (urls.length == 5) {
    // build 2x2 tiles around center pane
    let x = 0;
    for (let i = 0; i < urls.length; i++) {
      const view = views[i];
      let w = Math.floor((width / 3) * slaveFact);
      if (i == 2) {
        w = Math.ceil(width - 2 * w);
      }
      const b = {
        x,
        y: i == 1 || i == 4 ? Math.floor(height / 2) : 0,
        width: w,
        height: i == 2 ? height : Math.floor(height / 2),
      };
      console.log(i, b);
      view.setBounds(b);
      if (i > 0 && i < 3) {
        x += w;
      }
    }
  } else {
    // build a 2 row grid
    const rows = 2;
    const columns = Math.ceil(urls.length / rows);
    const columnsLastRow = Math.floor(urls.length / rows);
    for (let r = 0; r < rows; r++) {
      const cols = r < rows - 1 ? columns : columnsLastRow;
      for (let c = 0; c < cols; c++) {
        const view = views[r * columns + c];
        const b = {
          x: c * Math.floor(width / cols),
          y: r * Math.floor(height / rows),
          width: Math.floor(width / cols),
          height: Math.floor(height / rows),
        };
        // console.log(r, c, b);
        view.setBounds(b);
      }
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  console.log(`uid: ${uid}`);

  // Create the browser window.
  createWindow(process.env.NODE_ENV === "development") // debug?
    .then(() => {
      mainWindow.on("show", () => {
        // Wait for the window to be ready to show, then get its dimensions
        // and build the views.
        reorientViews();
        mainWindow.on("resize", reorientViews);
      });
    })
    .catch((err) => {
      console.error(err);
      app.quit();
    });
});

// Quit when all windows are closed, also on macOS since
// app is temporary and don't has a unique icon on the dock.
app.on("window-all-closed", function () {
  app.quit();
});
