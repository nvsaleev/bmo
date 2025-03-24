import Image from "next/image";
import Link from "next/link";

const BMOLogo = () => <Image src="/bmo_logo.svg" alt="BMO Logo" width={144} height={50}/>

export default function Navbar({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
        <>
            <nav className="fixed flex flex-row gap-12 items-center w-full h-24 py-4 px-12 border-b border-b-neutral-200 shadow">
                <Link href={"/"} className="underline-offset-4 hover:text-bmo-blue hover:underline" > 
                    <BMOLogo/>
                </Link>
                <nav className="flex flex-row gap-6 items-center text-lg text-black">
                    <Link href={"/"} className="underline-offset-4 hover:text-bmo-blue hover:underline" >Stocks</Link>
                    <Link href={"/"} className="underline-offset-4 hover:text-bmo-blue hover:underline" >Options</Link>
                    <Link href={"/"} className="underline-offset-4 hover:text-bmo-blue hover:underline" >Futures</Link>
                </nav>
                <Image src='/taleb.png' width={60} height={60} alt="Quant" className="rounded-full ml-auto border border-bmo-blue hover:cursor-pointer" />
            </nav>
            {children}
        </>
    );
  }