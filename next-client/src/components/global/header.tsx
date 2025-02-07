import Link from 'next/link';

// Define the type for the navigation items
type NavItem = {
  name: string;
  path: string;
};

// Array of navigation items
const navItems: NavItem[] = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'News', path: '/news' },
  { name: 'Contact', path: '/contact' },
];

const Header = () => {
  return (
    <header className=" w-full z-50 backdrop-blur-md bg-opacity-75 bg-transparent border-b border-gray-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Title */}
          <Link href="/">
            <span className="text-2xl font-bold text-white cursor-pointer">News Bug</span>
          </Link>

          {/* Navigation Menu */}
          <nav className="hidden md:flex space-x-4">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <span className="text-gray-300 hover:text-white cursor-pointer">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button (Hamburger Icon) */}
          <button className="md:hidden p-2 text-gray-300 hover:text-white focus:outline-none">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16m-7 6h7"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu (Hidden by default) */}
      <div className="md:hidden bg-gray-800 bg-opacity-75">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <span className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium cursor-pointer">
                {item.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Header;