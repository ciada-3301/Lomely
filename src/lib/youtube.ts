export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (hrs > 0 && hrs < 24) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  if (hrs >= 24) {
    return "LIVE";
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
