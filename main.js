// Enable experimental features to support multiple browser views in a single browser
process.env.ELECTRON_ENABLE_EXPERIMENTAL_FEATURES = true;

// Modules to control application life and create native browser window
const { app, BrowserWindow, BrowserView } = require("electron");
const path = require("node:path");

const urls = process.argv.slice(2).map((url) => `https://${url}`);

let mainWindow;
const views = [];

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    fullscreen: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const view = new BrowserView({
      webPreferences: {
        partition: `persist:${i}~${url}`,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    view.webContents.loadURL(url);
    views.push(view);
  }
}

function reorientViews() {
  const [width, height] = mainWindow.getSize();
  if (urls.length < 4) {
    // build up to 3 columns
    for (let i = 0; i < urls.length; i++) {
      const view = views[i];
      mainWindow.addBrowserView(view);
      view.setBounds({
        x: (i % urls.length) * Math.floor(width / urls.length),
        y: 0,
        width: Math.floor(width / urls.length),
        height,
      });
    }
  } else if (urls.length == 5) {
    // build 2x2 tiles around center pane
    for (let i = 0; i < urls.length; i++) {
      const view = views[i];
      mainWindow.addBrowserView(view);
      view.setBounds({
        x: i < 2 ? 0 : i == 3 ? Math.floor(width / 4) : Math.floor(width / 4) * 3,
        y: i == 1 || i == 4 ? Math.floor(height / 2) : 0,
        width: i == 3 ? Math.floor(width / 2) : Math.floor(width / 4),
        height: i == 3 ? height : Math.floor(height / 2),
      });
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
        view.setBounds({
          x: c * Math.floor(width / cols),
          y: r * Math.floor(height / rows),
          width: Math.floor(width / cols),
          height: Math.floor(height / rows),
        });
      }
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
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
