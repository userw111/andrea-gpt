const { app, BrowserWindow } = require("electron")
const path = require("path")
const isDev = require("electron-is-dev")
const { spawn } = require("child_process")

let mainWindow
let nextServer

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (isDev) {
    // In development, load from the Next.js dev server.
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools()
  } else {
    // In production, we'll serve the Next.js build.
    // This part can be tricky and might need a more robust solution
    // for starting the server and knowing when it's ready.
    const serverPath = path.join(__dirname, "node_modules/.bin/next")
    nextServer = spawn(serverPath, ["start", "-p", "3000"], {
      cwd: __dirname,
      stdio: "inherit",
      shell: true
    })
    mainWindow.loadURL("http://localhost:3000")
  }

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

app.on("ready", createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  if (nextServer) {
    nextServer.kill()
  }
})

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow()
  }
}) 