const path = require('path')
const httpServer = require('http')
const httpsServer = require('https')
const os = require('os')
const fs = require('fs').promises
const childProcess = require('child_process')
const pkg = require('./package.json')
const scripts = require('./nwjs-scripts')


const autoupdate = async () => {
	/* eslint-disable no-console */
	if (process.platform === 'linux') {
		throw new Error('Linux does not support auto update')
	}
	const UPDATES_MANIFEST_URL = `${pkg.autoupdate}/${process.platform}/latest.json`
	const UPDATES_DIR = path.resolve(os.tmpdir(), pkg['executable-name'])
	const UPDATER_BIN_NAME = /^win/.test(process.platform) ? 'updater.exe' : 'updater'

	// Download manifest
	console.log(`AUTOUPDATE: Downloading manifest from: ${UPDATES_MANIFEST_URL}...`)
	const manifest = await (await fetch(UPDATES_MANIFEST_URL)).json()
	if (manifest.version === pkg.version) {
		throw new Error('App is up to date!')
	}
	console.log('AUTOUPDATE: Update manifest', manifest)

	// Make update temp directory
	console.log(`AUTOUPDATE: Using update directory: ${UPDATES_DIR}`)
	try {
		await fs.mkdir(UPDATES_DIR, { recursive : true })
	} catch (e) {
		console.log('AUTOUPDATE: Error creating update dir')
	}

	// Donwload the src (or skip if already donwloaded)
	console.log('AUTOUPDATE: Grabbing source...')

	const sourceTempDest = path.resolve(UPDATES_DIR, '.update.zip')
	const sourceFinalDest = path.resolve(UPDATES_DIR, `${manifest.version}.zip`)
	const sourceUrl = `${pkg.autoupdate}/${process.platform}/${manifest.src.path}`

	if (!await fs.access(sourceFinalDest)) {
		console.log(`AUTOUPDATE: Clearing temp destination: ${sourceTempDest}`)
		await fs.unlink(sourceTempDest)
		console.log(`AUTOUPDATE: Downloading source from: ${sourceUrl}`)
		await new Promise((resolve, reject) => {
			const http = /^https/.test(sourceUrl) ? httpsServer : httpServer
			http.get(sourceUrl, res => {
				if (res.statusCode !== 200) {
					return reject(new Error(res.statusMessage))
				}
				res.pipe(fs.createWriteStream(sourceTempDest))
					.on('finish', async () => {
						console.log('AUTOUPDATE: Moving source from temporary to final destination')
						try {
							await fs.rename(sourceTempDest, sourceFinalDest)
							resolve()
						} catch (e) {
							reject(e)
						}
					})
					.on('error', err => reject(err))
				return null
			})
		})
		console.log('AUTOUPDATE: Source successfully donwloaded!')
	} else {
		console.log(`AUTOUPDATE: Source already downloaded at ${sourceFinalDest}`)
	}

	// Notify user about the update
	console.log('AUTOUPDATE: Displaying notification to user...')
	await new Promise((resolve, reject) => {
		const options = {
			icon               : 'nwjs-assets/icon.png',
			body               : 'Click here to install update',
			requireInteraction : true
		}
		const notification = new Notification('A new update is available!', options)
		notification.onclick = () => {
			notification.close()
			resolve()
		}
		notification.onclose = () => reject(new Error('User closed the update notification.'))
	})

	// Copy the update binary to the update dir
	console.log(`AUTOUPDATE: Moving updater binary to ${path.resolve(UPDATES_DIR, UPDATER_BIN_NAME)}`)
	await fs.copyFile(
		path.resolve(UPDATER_BIN_NAME),
		path.resolve(UPDATES_DIR, UPDATER_BIN_NAME)
	)
	await fs.chmod(
		path.resolve(UPDATES_DIR, UPDATER_BIN_NAME),
		755 & ~process.umask()
	)
	// Run the update binary
	let instDir
	switch (process.platform) {
		case 'darwin':
			instDir = path.resolve('./../../../../')
			break
		case 'win32':
			instDir = path.resolve('./')
			break
		default:
			break
	}
	const args = [
		path.resolve(UPDATES_DIR, UPDATER_BIN_NAME),
		[
			'--bundle', path.resolve(UPDATES_DIR, `${manifest.version}.zip`),
			'--inst-dir', instDir,
			'--app-name', pkg['executable-name']
		],
		{
			cwd      : path.dirname(UPDATES_DIR),
			detached : true,
			stdio    : 'ignore',
		}
	]
	console.log(`AUTOUPDATE: Running updater:\n${JSON.stringify(args)}`)
	childProcess.spawn.apply(this, args).unref()

	// Quit the app
	console.log('AUTOUPDATE: Quitting app...')
	window.nw.App.quit()
	/* eslint-enable no-console */
}

exports.init = async () => {
	// Graceful shutdown, kind of
	process.on('SIGQUIT', () => process.exit())
	process.on('SIGHUP', () => process.exit())
	process.on('SIGINT', () => process.exit()) // catch ctrl-c
	process.on('SIGTERM', () => process.exit()) // catch kill

	// run the app's main script
	await scripts.main()

	// autoupdate
	autoupdate()
}
