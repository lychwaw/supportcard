import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';

export interface ScannedReceipt {
  amount: number | null;
  category: string;
  description: string | null;
  merchant: string | null;
  imageUri: string;
}

export async function scanReceiptFromCamera(): Promise<ScannedReceipt | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.6,
    base64: true,
    allowsEditing: true,
    aspect: [3, 4],
  });

  if (result.canceled || !result.assets[0]) return null;
  return processImage(result.assets[0]);
}

export async function scanReceiptFromLibrary(): Promise<ScannedReceipt | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.6,
    base64: true,
    allowsEditing: true,
    aspect: [3, 4],
  });

  if (result.canceled || !result.assets[0]) return null;
  return processImage(result.assets[0]);
}

async function processImage(asset: ImagePicker.ImagePickerAsset): Promise<ScannedReceipt | null> {
  let base64 = asset.base64;

  // If base64 wasn't provided inline, read the file
  if (!base64 && asset.uri) {
    base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  if (!base64) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          action: 'scan-receipt',
          image_base64: base64,
          media_type: asset.mimeType ?? 'image/jpeg',
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();

    return {
      amount: data.amount ?? null,
      category: data.category ?? 'Other',
      description: data.description ?? null,
      merchant: data.merchant ?? null,
      imageUri: asset.uri,
    };
  } catch {
    return null;
  }
}
