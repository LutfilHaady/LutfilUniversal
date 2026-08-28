export function buildMixingStepDisplayRef(
  batchId: string,
  label: string,
  stepNumber: number,
): string {
  return `${batchId} / ${label} · Step ${String(stepNumber).padStart(2, '0')}`;
}

export function exportQR(svgId: string, filename: string, format: 'svg' | 'jpg') {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  
  // Clone the SVG so we can manipulate it without affecting the DOM
  const svgClone = svg.cloneNode(true) as SVGElement;
  
  // Ensure the clone has explicit width and height for canvas drawing
  const width = svg.clientWidth || 256;
  const height = svg.clientHeight || 280;
  svgClone.setAttribute('width', width.toString());
  svgClone.setAttribute('height', height.toString());

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgClone);

  if (format === 'svg') {
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const img = new Image();
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 0, 0);
      
      const jpgUrl = canvas.toDataURL('image/jpeg', 0.92);
      const a = document.createElement('a');
      a.href = jpgUrl;
      a.download = `${filename}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
}
