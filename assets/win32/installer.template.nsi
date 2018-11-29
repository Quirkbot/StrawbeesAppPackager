!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "WinMessages.nsh"
!include "WinVer.nsh"
!include "x64.nsh"

RequestExecutionLevel user

Name "{{APP_NAME}} {{APP_VERSION}}"
BrandingText "{{APP_PUBLISHER}}"

# set the icon
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

# define the resulting installer's name:
OutFile "{{RELATIVE_BUILD_PATH}}\{{APP_EXECUTABLE_NAME}}-installer.exe"

# set the installation directory
InstallDir "$APPDATA\{{APP_NAME}}\"

# app dialogs
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN_TEXT "Start {{APP_NAME}}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\{{APP_EXECUTABLE_NAME}}.exe"

!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

# default section start
Section
    # kill any instance of the app
    ExecWait 'taskkill /f /im "{{APP_EXECUTABLE_NAME}}.exe" /t'
    Sleep 4000

    # delete the installed files
    RMDir /r $INSTDIR

    # define the path to which the installer should install
    SetOutPath $INSTDIR

    # copy the app files to the output path
    File /r "{{RELATIVE_BUILD_PATH}}\app\*"

    # install the drivers
    ${If} ${AtMostWin8.1}
        ${if} ${RunningX64}
            # ExecWait '"$INSTDIR\nwjs-assets\win32\drivers\dpinst-amd64.exe" /u nwjs-assets\win32\drivers\old1000\quirkbot.inf /S' $1
            # DetailPrint "Uninstall: $1"
            ExecWait '"$INSTDIR\nwjs-assets\win32\drivers\dpinst-amd64.exe" /sw' $1
        ${Else}
            # ExecWait '"$INSTDIR\nwjs-assets\win32\drivers\dpinst-x86.exe" /u nwjs-assets\win32\drivers\old1000\quirkbot.inf /S' $1
            # DetailPrint "Uninstall: $1"
            ExecWait '"$INSTDIR\nwjs-assets\win32\drivers\dpinst-x86.exe" /sw' $1
        ${EndIf}
            DetailPrint "Installation: $1"
        ${If} $1 <= 0
            MessageBox MB_OK "Driver installation failed. Please try again."
            Sleep 1000
        ${EndIf}
    ${EndIf}

    # create the uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    # add uninstall information to Add/Remove Programs
    WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
        "DisplayName" "{{APP_NAME}}"
    WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
        "Publisher" "{{APP_PUBLISHER}}"
    WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
        "DisplayIcon" '"$INSTDIR\nwjs-assets\win32\icon.ico"'
    WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
        "DisplayVersion" "{{APP_VERSION}}"
    WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
        "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
        "QuietUninstallString" '"$INSTDIR\uninstall.exe"'
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
        "EstimatedSize" "$0"

    # register the app url scheme
    # (most instructions I've found tell the scheme should be installed to HKCR
    # that requires admin access. But apparently installing to
    # HKCU Software\Classes\ does the trick)
    DetailPrint "Register {{APP_URL_SCHEME}} URI Handler"
    DeleteRegKey HKCU "Software\Classes\{{APP_URL_SCHEME}}"
    WriteRegStr HKCU "Software\Classes\{{APP_URL_SCHEME}}" "" ""
    WriteRegStr HKCU "Software\Classes\{{APP_URL_SCHEME}}" "URL Protocol" ""
    WriteRegStr HKCU "Software\Classes\{{APP_URL_SCHEME}}\DefaultIcon" "" "$INSTDIR\{{APP_EXECUTABLE_NAME}}.exe,0"
    WriteRegStr HKCU "Software\Classes\{{APP_URL_SCHEME}}\shell" "" ""
    WriteRegStr HKCU "Software\Classes\{{APP_URL_SCHEME}}\shell\open" "" ""
    WriteRegStr HKCU "Software\Classes\{{APP_URL_SCHEME}}\shell\open\command" "" '"$INSTDIR\{{APP_EXECUTABLE_NAME}}.exe" "%1"'
    WriteRegStr HKCU "Software\Classes\{{APP_URL_SCHEME}}\shell\open\ddeexec" "" ""

    # create shortcuts in the start menu and on the desktop
    DetailPrint "Creating shortcuts"
    Delete "$SMPROGRAMS\{{APP_NAME}}\{{APP_NAME}}.lnk"
    Delete "$SMPROGRAMS\{{APP_NAME}}\uninstall.lnk"
    Delete "$SMPROGRAMS\{{APP_NAME}}"
    Delete "$DESKTOP\{{APP_NAME}}.lnk"
    CreateDirectory "$SMPROGRAMS\{{APP_NAME}}"
    CreateShortCut "$SMPROGRAMS\{{APP_NAME}}\{{APP_NAME}}.lnk" "$INSTDIR\{{APP_EXECUTABLE_NAME}}.exe"
    CreateShortCut "$SMPROGRAMS\{{APP_NAME}}\uninstall.lnk" "$INSTDIR\uninstall.exe"
    CreateShortCut "$DESKTOP\{{APP_NAME}}.lnk" "$INSTDIR\{{APP_EXECUTABLE_NAME}}.exe"

SectionEnd

# create a section to define what the uninstaller does
Section "Uninstall"

    # remove uninstall information from Add/Remove Programs
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}"

    # register the app url scheme
    DeleteRegKey HKCU "Software\Classes\{{APP_URL_SCHEME}}"

    # delete the shortcuts
    Delete "$SMPROGRAMS\{{APP_NAME}}\{{APP_NAME}}.lnk"
    Delete "$SMPROGRAMS\{{APP_NAME}}\uninstall.lnk"
    Delete "$SMPROGRAMS\{{APP_NAME}}"
    Delete "$DESKTOP\{{APP_NAME}}.lnk"

    # delete the installed files
    RMDir /r $INSTDIR

SectionEnd
