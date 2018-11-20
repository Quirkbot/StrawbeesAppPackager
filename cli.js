#!/usr/bin/env node
const NWB = require('nwjs-builder')
const path = require('path')
const fs = require('fs').promises
const cpdir = require('./utils/cpdir')
const download = require('./utils/download')
const execute = require('./utils/execute')
const modulePath = require('./utils/modulePath')
const rimraf = require('./utils/rimraf')
const unzip = require('./utils/unzip')
const zipdir = require('./utils/zipdir')

const [,, ...cmdargs] = process.argv
const SRC_DIR = path.resolve(cmdargs[0] || 'src')
const BUILD_DIR = path.resolve(cmdargs[1] || 'build')
const TEMP_DIR = path.resolve(cmdargs[2] || '.tmp')
const COMMON_SCRIPTS_DIR = path.resolve(__dirname, 'src')
const PLATFORM_ASSETS_DIR = path.resolve(TEMP_DIR, 'nwjs-assets', process.platform)
const COMMON_PLATFORM_ASSETS_DIR = path.resolve(__dirname, 'assets', process.platform)

execute(async ({ exec }) => {
	// clean slate
	await rimraf(BUILD_DIR)
	await rimraf(TEMP_DIR)
	await fs.mkdir(BUILD_DIR)
	await fs.mkdir(TEMP_DIR)

	// copy src to temp
	await cpdir(SRC_DIR, TEMP_DIR)

	// moves the nwjs scripts and modify the package
	await cpdir(COMMON_SCRIPTS_DIR, TEMP_DIR)
	const tmpPkg = JSON.parse((await fs.readFile(path.resolve(TEMP_DIR, 'package.json'))).toString())
	tmpPkg['node-main'] = '__node-main.js'
	tmpPkg.inject_js_end = '__inject_js_end.js'
	tmpPkg.inject_js_start = '__inject_js_start.js'
	await fs.writeFile(path.resolve(TEMP_DIR, 'package.json'), JSON.stringify(tmpPkg, null, '\t'))

	// moves the platform specific assets
	await cpdir(COMMON_PLATFORM_ASSETS_DIR, PLATFORM_ASSETS_DIR)
	await fs.rename(
		path.resolve(PLATFORM_ASSETS_DIR, /^win/.test(process.platform) ? 'updater.exe' : 'updater'),
		path.resolve(TEMP_DIR, /^win/.test(process.platform) ? 'updater.exe' : 'updater')
	)

	// install src npm dependencies
	await exec(`cd ${TEMP_DIR} && npm install --production`)

	// build the app
	// retrive the app package
	const appPkg = JSON.parse((await fs.readFile(path.resolve(SRC_DIR, 'package.json'))).toString())
	await new Promise((resolve, reject) => {
		NWB.commands.nwbuild(
			TEMP_DIR,
			{
				outputDir      : BUILD_DIR,
				version        : appPkg['nwjs-version'],
				outputName     : 'app',
				executableName : appPkg['executable-name'],
				sideBySide     : true,
				macIcns        : path.resolve(PLATFORM_ASSETS_DIR, 'icon.icns')
				// Disavbled windows icon, see manaul resourcehacker call below
				// winIco         : path.resolve(PLATFORM_ASSETS_DIR, 'icon.ico'),
			},
			error => {
				if (error) {
					return reject(error)
				}
				return resolve()
			}
		)
	})
	// NWB calls ResourceHacker internally (by using the node-resourcehacker
	// module). But as this module hasn't been updated to the new command line
	// arguments of ResourceHacker.exe, we will download our own binary and call
	// it manually
	if (process.platform === 'win32') {
		// download and unzinp Resource Hacker
		await rimraf(path.resolve(__dirname, 'rh'))
		await fs.mkdir(path.resolve(__dirname, 'rh'))
		await download(
			process.env.RESOURCE_HACKER_URL || 'http://www.angusj.com/resourcehacker/resource_hacker.zip',
			path.resolve(__dirname, 'rh', 'rh.zip')
		)
		await unzip(
			path.resolve(__dirname, 'rh', 'rh.zip'),
			path.resolve(__dirname, 'rh')
		)
		// change the exe icon
		await exec(
			`${path.resolve(__dirname, 'rh', 'ResourceHacker.exe')} ` +
			`-open ${path.resolve(BUILD_DIR, 'app', `${appPkg['executable-name']}.exe`)} ` +
			`-save ${path.resolve(BUILD_DIR, 'app', `${appPkg['executable-name']}.exe`)} ` +
			'-action addoverwrite ' +
			`-res ${path.resolve(PLATFORM_ASSETS_DIR, 'icon.ico')} ` +
			'-mask ICONGROUP, IDR_MAINFRAME'
		)
	}
	// NWB transforms realtive symlinks into absolute ones, which totally breaks
	// the application when you run it from another machine. So for now, we will
	// just manually fix those symlinks
	if (process.platform === 'darwin') {
		await exec(`
			cd "$(find . -name "nwjs Framework.framework")"
			rm "Versions/Current" && ln -s "./A" "./Versions/Current"
			rm "Helpers" && ln -s "./Versions/Current/Helpers"
			rm "Internet Plug-Ins" && ln -s "./Versions/Current/Internet Plug-Ins"
			rm "Libraries" && ln -s "./Versions/Current/Libraries"
			rm "nwjs Framework" && ln -s "./Versions/Current/nwjs Framework"
			rm "Resources" && ln -s "./Versions/Current/Resources"
			rm "XPCServices" && ln -s "./Versions/Current/XPCServices"
		`)
	}

	// package the app
	const packageForOs = {}
	// windows packager
	packageForOs.win32 = async () => {
		// Create the NSIS file from the template
		const template = (await fs.readFile(path.resolve(PLATFORM_ASSETS_DIR, 'installer.nsi.template'))).toString()
			.split('{{APP_NAME}}').join(appPkg['executable-name'])
			.split('{{RELATIVE_BUILD_PATH}}').join(path.relative(PLATFORM_ASSETS_DIR, BUILD_DIR))
		await fs.writeFile(path.resolve(PLATFORM_ASSETS_DIR, 'installer.nsi'), template)

		// Execute the NSIS builder
		await exec(`makensis.exe /V4 ${PLATFORM_ASSETS_DIR}\\installer.nsi`)

		// Create the out directory
		await fs.mkdir(path.resolve(BUILD_DIR, 'versions'))
		await fs.mkdir(path.resolve(BUILD_DIR, 'versions', process.platform))
		await fs.mkdir(path.resolve(BUILD_DIR, 'versions', process.platform, appPkg.version))

		// Change the icon of the installer
		await exec(
			`${path.resolve(__dirname, 'rh', 'ResourceHacker.exe')} ` +
			`-open ${path.resolve(BUILD_DIR, `${appPkg['executable-name']} Installer.exe`)} ` +
			`-save ${path.resolve(BUILD_DIR, `${appPkg['executable-name']} Installer.exe`)} ` +
			'-action addoverwrite ' +
			`-res ${path.resolve(PLATFORM_ASSETS_DIR, 'icon.ico')} ` +
			'-mask ICONGROUP, IDR_MAINFRAME'
		)

		// Move the installer
		await fs.rename(
			path.resolve(BUILD_DIR, `${appPkg['executable-name']} Installer.exe`),
			path.resolve(BUILD_DIR, 'versions', process.platform, appPkg.version, `${appPkg['executable-name']}-${process.platform}-${appPkg.version}-installer.exe`)
		)

		// Zip the source
		await zipdir(
			path.resolve(BUILD_DIR, 'app'),
			path.resolve(BUILD_DIR, 'versions', process.platform, appPkg.version, `${appPkg['executable-name']}-${process.platform}-${appPkg.version}-src.zip`),
			''
		)

		// Create the latest manifest
		await fs.writeFile(
			path.resolve(BUILD_DIR, 'versions', process.platform, 'latest.json'),
			JSON.stringify({
				name      : appPkg.name,
				version   : appPkg.version,
				createdAt : new Date(),
				installer : {
					path : `${appPkg.version}/${appPkg['executable-name']}-${process.platform}-${appPkg.version}-installer.exe`
				},
				src : {
					path : `${appPkg.version}/${appPkg['executable-name']}-${process.platform}-${appPkg.version}-src.zip`
				}
			})
		)
	}

	// mac packager
	packageForOs.darwin = async () => {
		// Create the out directory
		await fs.mkdir(path.resolve(BUILD_DIR, 'versions'))
		await fs.mkdir(path.resolve(BUILD_DIR, 'versions', process.platform))
		await fs.mkdir(path.resolve(BUILD_DIR, 'versions', process.platform, appPkg.version))
		// Zip the source
		await zipdir(
			path.resolve(BUILD_DIR, 'app', `${appPkg['executable-name']}.app`),
			path.resolve(BUILD_DIR, 'versions', process.platform, appPkg.version, `${appPkg['executable-name']}-${process.platform}-${appPkg.version}-src.zip`),
			`${appPkg['executable-name']}.app`
		)
		// Create the DMG config
		const template = (await fs.readFile(path.resolve(PLATFORM_ASSETS_DIR, 'dmg.json.template'))).toString()
			.split('{{APP_NAME}}').join(appPkg['executable-name'])
			.split('{{RELATIVE_BUILD_PATH}}').join(path.relative(PLATFORM_ASSETS_DIR, BUILD_DIR))
		await fs.writeFile(path.resolve(PLATFORM_ASSETS_DIR, 'dmg.json'), template)
		// Build the DMG
		await new Promise((resolve, reject) => {
			// eslint-disable-next-line import/no-extraneous-dependencies, global-require
			const appdmg = require('appdmg')
			const dmg = appdmg({
				source : `${PLATFORM_ASSETS_DIR}/dmg.json`,
				target : path.resolve(BUILD_DIR, 'versions', process.platform, appPkg.version, `${appPkg['executable-name']}-${process.platform}-${appPkg.version}-installer.dmg`)
			})
			dmg.on('finish', resolve)
			dmg.on('error', reject)
		})

		// Create the latest manifest
		await fs.writeFile(
			path.resolve(BUILD_DIR, 'versions', process.platform, 'latest.json'),
			JSON.stringify({
				name      : appPkg.name,
				version   : appPkg.version,
				createdAt : new Date(),
				installer : {
					path : `${appPkg.version}/${appPkg['executable-name']}-${process.platform}-${appPkg.version}-installer.dmg`
				},
				src : {
					path : `${appPkg.version}/${appPkg['executable-name']}-${process.platform}-${appPkg.version}-src.zip`
				}
			})
		)
	}

	await packageForOs[process.platform]()

	// clear temp dir
	await rimraf(TEMP_DIR)
})
