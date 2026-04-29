$source = "C:\Users\xxphg\Downloads\wc-prediction-phase9-1.tar\wc-prediction-phase9-1\wc-prediction"
$destination = "C:\Users\xxphg\Downloads\wc-prediction-clean"

Write-Host "Installing update..."

Copy-Item "$source\src" -Destination "$destination\src" -Recurse -Force
Copy-Item "$source\server" -Destination "$destination\server" -Recurse -Force
Copy-Item "$source\public" -Destination "$destination\public" -Recurse -Force
Copy-Item "$source\package.json" -Destination "$destination\package.json" -Force

Write-Host "Update installed successfully."