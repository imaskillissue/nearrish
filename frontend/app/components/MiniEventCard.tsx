
type MiniEventCardProps = {
  event: {
    id: string;
    name: string;
    date?: string;
    price?: number;
    image?: string;
    photo?: string;
  };
  onClose: () => void;
};

export default function MiniEventCard({ event, onClose }: MiniEventCardProps) {
  const imageSrc = event.photo || event.image || '/favicon.ico';
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-72 ">
      <div className="relative" style={{ overflow: 'hidden', borderRadius: '0.75rem' }}>
        <img src={imageSrc} style={{ width: '100%', height: 48, objectFit: 'cover', display: 'block' }} />
      </div>
      <div className="p-3">
        <h3 className="font-bold truncate">{event.name}</h3>
        <p className="text-gray-400 text-xs">{event.date}</p>
        <p className="font-semibold text-sm mt-1">{event.price}€</p>
      </div>
    </div>
  )
}