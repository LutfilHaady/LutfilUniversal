# Fix DATABASE_URL to add connection_limit=1 for Prisma + Supabase PgBouncer
# This fixes the "prepared statement already exists" error

$envFiles = @(".env", ".env.local")

foreach ($file in $envFiles) {
    if (Test-Path $file) {
        Write-Host "Checking $file..."
        
        $content = Get-Content $file -Raw
        $originalContent = $content
        
        # Pattern 1: Has pgbouncer=true but missing connection_limit
        if ($content -match 'DATABASE_URL=(.+?)(\?pgbouncer=true)([^\r\n]*)') {
            $fullMatch = $matches[0]
            $beforeParams = $matches[1]
            $pgbouncer = $matches[2]
            $afterParams = $matches[3]
            
            if ($afterParams -notmatch 'connection_limit') {
                Write-Host "Found DATABASE_URL in $file that needs fixing..."
                
                # Add connection_limit=1
                $newLine = "DATABASE_URL=$beforeParams$pgbouncer&connection_limit=1$afterParams"
                $content = $content -replace [regex]::Escape($fullMatch), $newLine
                
                if ($content -ne $originalContent) {
                    Set-Content $file -Value $content -NoNewline
                    Write-Host "✓ Fixed DATABASE_URL in $file - added &connection_limit=1"
                }
            } else {
                Write-Host "✓ $file already has connection_limit parameter"
            }
        }
        # Pattern 2: Has pgbouncer=true with other params but missing connection_limit
        elseif ($content -match 'DATABASE_URL=(.+?)(\?pgbouncer=true&[^\r\n]*)') {
            $fullMatch = $matches[0]
            
            if ($fullMatch -notmatch 'connection_limit') {
                Write-Host "Found DATABASE_URL in $file that needs fixing..."
                
                # Add &connection_limit=1 at the end
                $newLine = $fullMatch + "&connection_limit=1"
                $content = $content -replace [regex]::Escape($fullMatch), $newLine
                
                if ($content -ne $originalContent) {
                    Set-Content $file -Value $content -NoNewline
                    Write-Host "✓ Fixed DATABASE_URL in $file - added &connection_limit=1"
                }
            } else {
                Write-Host "✓ $file already has connection_limit parameter"
            }
        }
        else {
            Write-Host "  No DATABASE_URL with pgbouncer=true found in $file (or format is different)"
        }
    } else {
        Write-Host "$file not found, skipping..."
    }
}

Write-Host "`nDone! Please restart your Next.js dev server for changes to take effect."

