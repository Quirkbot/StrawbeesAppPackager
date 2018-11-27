!include "MUI2.nsh"
!include "WinMessages.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"
!include "x64.nsh"

RequestExecutionLevel user

Name "{{APP_NAME}}"
BrandingText "strawbees.com"

# set the icon
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

# define the resulting installer's name:
OutFile "{{RELATIVE_BUILD_PATH}}\{{APP_NAME}} Installer.exe"

# set the installation directory
InstallDir "$APPDATA\{{APP_NAME}}\"

# app dialogs
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN_TEXT "Start {{APP_NAME}}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\{{APP_NAME}}.exe"

!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

# default section start
Section
  # kill any instance of the app
  ExecWait `taskkill /f /im "{{APP_NAME}}.exe" /t`
  Sleep 5000

  # delete the installed files
  RMDir /r $INSTDIR

  # define the path to which the installer should install
  SetOutPath $INSTDIR

  # copy the app files to the output path
  File /r "{{RELATIVE_BUILD_PATH}}\app\*"

  # install the drivers
  ${If} ${AtMostWin8.1}
      ${if} ${RunningX64}
          ExecWait '"$INSTDIR\nwjs-assets\win32\drivers\dpinst-amd64.exe" /u nwjs-assets\win32\drivers\old1000\quirkbot.inf /S' $1
          DetailPrint "Uninstall: $1"
          ExecWait '"$INSTDIR\nwjs-assets\win32\drivers\dpinst-amd64.exe" /sw' $1
      ${Else}
          ExecWait '"$INSTDIR\nwjs-assets\win32\drivers\dpinst-x86.exe" /u nwjs-assets\win32\drivers\old1000\quirkbot.inf /S' $1
          DetailPrint "Uninstall: $1"
          ExecWait '"$INSTDIR\nwjs-assets\win32\drivers\dpinst-x86.exe" /sw' $1
      ${EndIf}
      DetailPrint "Installation: $1"
      ${If} $1 <= 0
          MessageBox MB_OK "Driver installation failed. Please try again."
      ${EndIf}
  ${EndIf}

  # create the uninstaller
  WriteUninstaller "$INSTDIR\Uninstall {{APP_NAME}}.exe"

  # add uninstall information to Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
                   "DisplayName" "{{APP_NAME}}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
                   "UninstallString" "$INSTDIR\Uninstall {{APP_NAME}}.exe"

  # create shortcuts in the start menu and on the desktop
  CreateShortCut "$SMPROGRAMS\{{APP_NAME}}.lnk" "$INSTDIR\{{APP_NAME}}.exe"
  CreateShortCut "$SMPROGRAMS\Uninstall {{APP_NAME}}.lnk" "$INSTDIR\Uninstall {{APP_NAME}}.exe"
  CreateShortCut "$DESKTOP\{{APP_NAME}}.lnk" "$INSTDIR\{{APP_NAME}}.exe"

SectionEnd

# create a section to define what the uninstaller does
Section "Uninstall"

  # delete the installed files
  RMDir /r $INSTDIR

  # remove uninstall information from Add/Remove Programs
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}"

  # delete the shortcuts
  Delete "$SMPROGRAMS\{{APP_NAME}}.lnk"
  Delete "$SMPROGRAMS\Uninstall {{APP_NAME}}.lnk"
  Delete "$DESKTOP\{{APP_NAME}}.lnk"

SectionEnd
