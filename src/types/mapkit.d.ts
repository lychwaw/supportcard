export {};

declare global {
  interface Window {
    mapkit?: typeof mapkit;
  }

  const mapkit: {
    init: (options: { authorizationCallback: (done: (token: string) => void) => void }) => void;
    Map: new (element: HTMLElement, options?: Record<string, unknown>) => mapkit.Map;
    Coordinate: new (latitude: number, longitude: number) => mapkit.Coordinate;
    CoordinateSpan: new (latitudeDelta: number, longitudeDelta: number) => mapkit.CoordinateSpan;
    CoordinateRegion: new (center: mapkit.Coordinate, span: mapkit.CoordinateSpan) => mapkit.CoordinateRegion;
    MarkerAnnotation: new (coordinate: mapkit.Coordinate, options?: { title?: string }) => mapkit.Annotation;
    FeatureVisibility: {
      Hidden: unknown;
    };
  };

  namespace mapkit {
    interface Map {
      center: mapkit.Coordinate;
      region: mapkit.CoordinateRegion;
      addAnnotation: (annotation: mapkit.Annotation) => void;
      removeAnnotation: (annotation: mapkit.Annotation) => void;
    }

    interface Coordinate {
      latitude: number;
      longitude: number;
    }

    interface CoordinateSpan {
      latitudeDelta: number;
      longitudeDelta: number;
    }

    interface CoordinateRegion {
      center: mapkit.Coordinate;
      span: mapkit.CoordinateSpan;
    }

    interface Annotation {}
  }
}

