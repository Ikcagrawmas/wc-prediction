$source = "C:\Users\xxphg\Downloads\wc-prediction-phase9\wc-prediction"
$destination = "C:\Users\xxphg\Downloads\wc-prediction-clean"

Write-Host "Copying Phase 9 files..."

Copy-Item "$source\src\*" "$destination\src\" -Recurse -Force
Copy-Item "$source\server\*" "$destination\server\" -Recurse -Force
Copy-Item "$source\supabase\*" "$destination\supabase\" -Recurse -Force

Write-Host "Done. Restart your app now."