export default function SearchBar({
    setIsPressed,
  }: {
    setIsPressed: React.Dispatch<React.SetStateAction<boolean>>;
  }) {
    return (
      <button
        onClick={() => setIsPressed(true)}
        className="flex flex-row items-center justify-between text-neutral-500 text-lg border border-neutral-300 rounded-lg w-full py-2 px-4 hover:cursor-pointer hover:shadow"
      >
        <p>Add ticker</p>
        <div>&#8984; K </div>
      </button>
    );
}
  