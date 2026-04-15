// Minimal Google Maps type declarations for Places Autocomplete
// Full types available via: npm i -D @types/google.maps

declare namespace google {
  namespace maps {
    class LatLngBounds {
      constructor(sw: LatLngLiteral, ne: LatLngLiteral): LatLngBounds;
    }
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }
    interface LatLng {
      lat(): number;
      lng(): number;
    }
    namespace places {
      interface AutocompleteOptions {
        componentRestrictions?: { country: string | string[] };
        bounds?: google.maps.LatLngBounds;
        strictBounds?: boolean;
        fields?: string[];
        types?: string[];
      }
      interface PlaceGeometry {
        location: google.maps.LatLng;
      }
      interface PlaceResult {
        formatted_address?: string;
        geometry?: PlaceGeometry;
      }
      class Autocomplete {
        constructor(input: HTMLInputElement, opts?: AutocompleteOptions): Autocomplete;
        addListener(event: string, handler: () => void): void;
        getPlace(): PlaceResult;
      }
    }
  }
}

interface Window {
  google: typeof google;
}
