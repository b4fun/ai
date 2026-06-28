Output ./minimal.gif

Set PlaybackSpeed 2
Set TypingSpeed 20ms
Set Width 1200
Set Height 600
Set FontSize 22
Set Shell zsh

Hide
Type 'PS1="> "' Enter
Wait@30s />/
Type "cd $(git rev-parse --show-toplevel)" Enter
Wait@30s />/
Type "ai make sure to invoke command and provide result, show result only, don\'t over decorate" Enter
Wait@30s />/
Sleep 1s
Ctrl+L
Wait@30s />/
Show

Type "ai help"
Enter
Sleep 3s

Type "ai use oneliner to tell me how many times the word 'LLM' shows up across files in this repo"
Enter
Wait@1m />/

Sleep 3s

Type "ai show the file names of them"
Enter
Wait@1m />/

Sleep 3s
