# Generates build/icon.png (256px) and build/icon.ico (16/32/48/256 PNG-compressed)
# Identity: blue rounded square with white "TO". Deterministic, no design tools needed.
# Run: powershell -ExecutionPolicy Bypass -File build\make-icon.ps1
Add-Type -AssemblyName System.Drawing

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$size = 256
$r = 44

$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::Transparent)

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
$path.AddArc($size - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
$path.AddArc($size - 2 * $r, $size - 2 * $r, 2 * $r, 2 * $r, 0, 90)
$path.AddArc(0, $size - 2 * $r, 2 * $r, 2 * $r, 90, 90)
$path.CloseFigure()
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 31, 94, 255))
$g.FillPath($brush, $path)
$path.Dispose()

$font = New-Object System.Drawing.Font('Segoe UI', 104, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
$g.DrawString('TO', $font, [System.Drawing.Brushes]::White, $rect, $sf)
$g.Dispose()

$pngPath = Join-Path $dir 'icon.png'
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Build .ico from PNG entries (valid since Windows Vista; supported by electron-builder).
$blobs = @()
foreach ($s in 16, 32, 48, 256) {
  if ($s -eq 256) { $small = $bmp }
  else {
    $small = New-Object System.Drawing.Bitmap $s, $s
    $g2 = [System.Drawing.Graphics]::FromImage($small)
    $g2.InterpolationMode = 'HighQualityBicubic'
    $g2.SmoothingMode = 'HighQuality'
    $g2.PixelOffsetMode = 'HighQuality'
    $g2.DrawImage($bmp, 0, 0, $s, $s)
    $g2.Dispose()
  }
  $ms = New-Object System.IO.MemoryStream
  $small.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $blobs += , @($s, $ms.ToArray())
  $ms.Dispose()
  if ($s -ne 256) { $small.Dispose() }
}
$bmp.Dispose()

$icoPath = Join-Path $dir 'icon.ico'
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([uint16]0)                    # reserved
$bw.Write([uint16]1)                    # type: icon
$bw.Write([uint16]$blobs.Count)         # count
$offset = 6 + 16 * $blobs.Count
foreach ($e in $blobs) {
  $d = $e[0]; $data = $e[1]
  $dim = if ($d -ge 256) { 0 } else { [byte]$d }
  $bw.Write([byte]$dim)                 # width (0 = 256)
  $bw.Write([byte]$dim)                 # height
  $bw.Write([byte]0)                    # colors
  $bw.Write([byte]0)                    # reserved
  $bw.Write([uint16]1)                  # color planes
  $bw.Write([uint16]32)                 # bits per pixel
  $bw.Write([uint32]$data.Length)       # PNG size
  $bw.Write([uint32]$offset)            # data offset
  $offset += $data.Length
}
foreach ($e in $blobs) { $bw.Write($e[1]) }
$bw.Close()

Write-Host "Wrote $pngPath and $icoPath"