from PIL import Image
import random
import os

# Create icons directory if it doesn't exist
icons_dir = os.path.join('public', 'icons')
os.makedirs(icons_dir, exist_ok=True)

# Generate random colors (teal/blue theme with some variation)
colors = [
    (15, 118, 110),   # VOX Teal
    (8, 145, 178),    # VOX Blue
    (14, 165, 233),   # Light Blue
    (20, 184, 166),   # Teal
    (6, 182, 212),    # Cyan
]

# Generate icons
sizes = [16, 48, 128]

for size in sizes:
    # Pick a random color from our palette
    color = random.choice(colors)
    
    # Create image
    img = Image.new('RGB', (size, size), color)
    
    # Save
    icon_path = os.path.join(icons_dir, f'icon{size}.png')
    img.save(icon_path)
    print(f'Created {icon_path} ({size}x{size}) with color {color}')

print('\nAll icons generated successfully!')
