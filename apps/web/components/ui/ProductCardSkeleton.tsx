export default function ProductCardSkeleton() {
  return (
    <div className="card animate-pulse overflow-hidden">
      <div className="h-48 w-full bg-ghost-10" />
      <div className="space-y-2 p-5">
        <div className="h-4 w-2/3 rounded-full bg-ghost-10" />
        <div className="h-4 w-1/4 rounded-full bg-ghost-10" />
      </div>
    </div>
  );
}
