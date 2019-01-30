Outfile RequireAdmin.exe
RequestExecutionLevel admin ;Require admin rights on NT6+ (When UAC is turned on)

!include LogicLib.nsh

Function .onInit
UserInfo::GetAccountType
pop $0
${If} $0 != "admin" ;Require admin rights on NT4+
    MessageBox mb_iconstop "Administrator rights required!"
    SetErrorLevel 740 ;ERROR_ELEVATION_REQUIRED
    Quit
${EndIf}
FunctionEnd

Section
	Quit
SectionEnd