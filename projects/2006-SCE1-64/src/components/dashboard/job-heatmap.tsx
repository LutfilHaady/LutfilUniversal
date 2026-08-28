'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MapOptions } from 'leaflet';

const DynamicMap = dynamic(async () => {
  const { MapContainer, TileLayer, useMap } = await import('react-leaflet');
  const L = (await import('leaflet')).default as any;
  // @ts-ignore - plugin has no TS types
  await import('leaflet.heat');

  // ✅ Capitalized component, returns null => valid React component
  function HeatLayer({ points }: { points: [number, number, number?][] }) {
    const map = useMap();

    useEffect(() => {
      if (!map || !points?.length || !L?.heatLayer) return;

      const layer = L.heatLayer(points, {
        radius: 48,
        blur: 32,
        maxZoom: 19,
        max: 1.0,
        gradient: {
          0.05: '#00ffff',
          0.25: '#22c55e',
          0.45: '#facc15',
          0.70: '#f97316',
          0.90: '#ef4444',
          1.00: '#ffffff',
        },
      });
      layer.addTo(map);

      return () => {
        try {
          map.removeLayer(layer);
        } catch {}
      };
      // 🔔 Include everything used inside: map, points, L
    }, [map, points, L]);

    return null;
  }

  function MapWithHeat({
    points,
    mapOptions,
    className,
  }: {
    points: [number, number, number?][];
    mapOptions?: MapOptions;
    className?: string;
  }) {
    const options: MapOptions = {
      center: [1.3521, 103.8198],
      zoom: 11,
      scrollWheelZoom: false,
      ...mapOptions,
    };

    return (
      <MapContainer className={className ?? 'h-[420px] w-full rounded-md'} {...options}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <HeatLayer points={points} />
      </MapContainer>
    );
  }

  return MapWithHeat;
}, { ssr: false });

export function JobHeatmap({
  data,
  className,
}: {
  data?: Array<{ lat: number; lng: number; count?: number }>;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const points = useMemo(() => {
    const rows =
      data ??
      [
        { lat: 1.29027, lng: 103.851959, count: 120 },
        { lat: 1.3006,  lng: 103.8455,   count: 90 },
        { lat: 1.3347,  lng: 103.7465,   count: 70 },
        { lat: 1.279,   lng: 103.854,    count: 80 },
        { lat: 1.3547,  lng: 103.9445,   count: 60 },
        { lat: 1.3496,  lng: 103.9568,   count: 55 },
        { lat: 1.4173,  lng: 103.819,    count: 50 },
        { lat: 1.3521,  lng: 103.8198,   count: 65 },
      ];

    const maxCount = Math.max(60, ...rows.map(r => r.count ?? 0));
    const gamma = 0.6;

    return rows.map(({ lat, lng, count = 1 }) => {
      const linear = Math.min(1, count / maxCount);
      const boosted = Math.max(0.12, Math.pow(linear, gamma));
      return [lat, lng, boosted] as [number, number, number];
    });
  }, [data]);

  if (!mounted) return <div className={className ?? 'h-[420px] w-full rounded-md bg-muted'} />;

  return (
    <DynamicMap
      points={points}
      className={className ?? 'h-[420px] w-full rounded-md overflow-hidden'}
      mapOptions={{ zoomControl: true }}
    />
  );
}
