export interface ShareItem {
  id: string;
  resultImage: string;
  blessingText: string;
  timestamp: number;
  expiresAt: number;
}

export const createShareUrl = (baseUrl: string, id: string): string => {
  return `${baseUrl}/share/${id}`;
};

export const isShareExpired = (item: ShareItem): boolean => {
  return Date.now() > item.expiresAt;
};
