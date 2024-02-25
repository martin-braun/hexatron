// Enable experimental features to support multiple browser views in a single browser
process.env.ELECTRON_ENABLE_EXPERIMENTAL_FEATURES = true;

// Modules to control application life and create native browser window
const { app, shell, BrowserWindow, BrowserView } = require("electron");
const path = require("node:path");
const crypto = require("node:crypto");

const urls = process.argv.slice(2).map((url) => `https://${url}`);
const uid = crypto.createHash("sha256").update(urls.join("~")).digest("hex");

let mainWindow;
const views = [];

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    fullscreen: true,
    backgroundColor: "#000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const partition = `persist:${url}~${uid}#${i}`;
    const view = new BrowserView({
      webPreferences: {
        partition,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    view.webContents.loadURL(url);
    view.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    views.push(view);
    console.log(`spawned partition ${partition}`);
  }
}

function reorientViews() {
  const [width, height] = mainWindow.getSize();
  // use euler as slave width multiplier
  const slaveFact = Math.sqrt(3) / 2;
  if (urls.length < 3) {
    // build up to 2 columns
    let x = 0;
    for (let i = 0; i < urls.length; i++) {
      const view = views[i];
      mainWindow.addBrowserView(view);
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
      mainWindow.addBrowserView(view);
      let w = Math.floor(width / urls.length);
      w = Math.floor(i == 1 ? w / slaveFact : w * slaveFact);
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
      mainWindow.addBrowserView(view);
      let w = Math.floor(width / 3);
      w = Math.floor(i == 2 ? w / slaveFact : w * slaveFact);
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
        mainWindow.addBrowserView(view);
        const b = {
          x: c * Math.floor(width / cols),
          y: r * Math.floor(height / rows),
          width: Math.floor(width / cols),
          height: Math.floor(height / rows),
        };
        console.log(r, c, b);
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
  createWindow();

  mainWindow.on("show", () => {
    // Wait for the window to be ready to show, then get its dimensions
    // and build the views.
    reorientViews();
    mainWindow.on("resize", reorientViews);
  });

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
