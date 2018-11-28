!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "WinMessages.nsh"
!include "WinVer.nsh"
!include "x64.nsh"

RequestExecutionLevel admin

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
  WriteUninstaller "$INSTDIR\uninstall.exe"

  # add uninstall information to Add/Remove Programs
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
                     "DisplayName" "{{APP_NAME}}"
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
                     "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
                     "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\""
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}" \
                     "EstimatedSize" "$0"

  # register the app url scheme
  DetailPrint "Register {{APP_URL_SCHEME}} URI Handler"
  DeleteRegKey HKCU "{{APP_URL_SCHEME}}"
  WriteRegStr HKCU "{{APP_URL_SCHEME}}" "" "URL:{{APP_URL_SCHEME}}"
  WriteRegStr HKCU "{{APP_URL_SCHEME}}" "{{APP_NAME}} URL Protocol" ""
  WriteRegStr HKCU "{{APP_URL_SCHEME}}\DefaultIcon" "" "$INSTDIR\{{APP_NAME}}.exe"
  WriteRegStr HKCU "{{APP_URL_SCHEME}}\shell" "" ""
  WriteRegStr HKCU "{{APP_URL_SCHEME}}\shell\Open" "" ""
  WriteRegStr HKCU "{{APP_URL_SCHEME}}\shell\Open\command" "" "$INSTDIR\{{APP_NAME}}.exe %1"

  # create shortcuts in the start menu and on the desktop
  Delete "$SMPROGRAMS\{{APP_NAME}}.lnk"
  Delete "$SMPROGRAMS\Uninstall {{APP_NAME}}.lnk"
  Delete "$DESKTOP\{{APP_NAME}}.lnk"
  CreateDirectory "$SMPROGRAMS\{{APP_NAME}}"
  CreateShortCut "$SMPROGRAMS\{{APP_NAME}}\{{APP_NAME}}.lnk" "$INSTDIR\{{APP_NAME}}.exe"
  CreateShortCut "$SMPROGRAMS\{{APP_NAME}}\Uninstall {{APP_NAME}}.lnk" "$INSTDIR\uninstall.exe"
  CreateShortCut "$DESKTOP\{{APP_NAME}}.lnk" "$INSTDIR\{{APP_NAME}}.exe"

SectionEnd

# create a section to define what the uninstaller does
Section "Uninstall"

  # remove uninstall information from Add/Remove Programs
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{APP_NAME}}"

  # register the app url scheme
  DeleteRegKey HKCU "{{APP_URL_SCHEME}}"

  # delete the shortcuts
  Delete "$SMPROGRAMS\{{APP_NAME}}\{{APP_NAME}}.lnk"
  Delete "$SMPROGRAMS\{{APP_NAME}}\Uninstall {{APP_NAME}}.lnk"
  Delete "$DESKTOP\{{APP_NAME}}.lnk"

  # delete the installed files
  RMDir /r $INSTDIR

SectionEnd
