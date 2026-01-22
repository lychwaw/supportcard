import { useEffect, useRef, useState } from 'react';
import { initMapKit } from '@/lib/mapkit';

interface MapKitPreviewProps {
  latitude: number;
  longitude: number;
  title?: string;
  className?: string;
}

const MapKitPreview = ({ latitude, longitude, title, className }: MapKitPreviewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapkit.Map | null>(null);
  const annotationRef = useRef<mapkit.Annotation | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let isMounted = true;

    initMapKit()
      .then((mapkitInstance) => {
        if (!isMounted || !containerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new mapkitInstance.Map(containerRef.current, {
            isRotationEnabled: false,
            isPitchEnabled: false,
            showsCompass: mapkitInstance.FeatureVisibility.Hidden,
            showsMapTypeControl: false,
            showsZoomControl: false,
          });
        }

        const map = mapRef.current;
        const coordinate = new mapkitInstance.Coordinate(latitude, longitude);

        map.center = coordinate;
        map.region = new mapkitInstance.CoordinateRegion(
          coordinate,
          new mapkitInstance.CoordinateSpan(0.005, 0.005)
        );

        if (annotationRef.current) {
          map.removeAnnotation(annotationRef.current);
        }

        annotationRef.current = new mapkitInstance.MarkerAnnotation(coordinate, { title });
        map.addAnnotation(annotationRef.current);

        setAvailable(true);
      })
      .catch((error) => {
        console.warn('MapKit preview unavailable:', error);
        if (isMounted) setAvailable(false);
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, title]);

  if (!available) {
    return (
      <div className={`rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground ${className || ''}`}>
        Map preview unavailable. Configure a MapKit token to enable the embedded map.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-48 w-full rounded-lg border ${className || ''}`}
    />
  );
};

export default MapKitPreview;

