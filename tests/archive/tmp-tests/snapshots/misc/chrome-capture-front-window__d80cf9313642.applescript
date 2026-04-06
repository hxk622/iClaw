set outputPath to "/tmp/iclaw-tool-card-dark-window.png"

tell application "Google Chrome"
  activate
  delay 1
  set windowBounds to bounds of window 1
end tell

set leftPos to item 1 of windowBounds
set topPos to item 2 of windowBounds
set rightPos to item 3 of windowBounds
set bottomPos to item 4 of windowBounds
set captureWidth to rightPos - leftPos
set captureHeight to bottomPos - topPos

do shell script "screencapture -x -R" & leftPos & "," & topPos & "," & captureWidth & "," & captureHeight & " " & quoted form of outputPath
return outputPath
