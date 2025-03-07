"use client";
import React, { useEffect, useState } from "react";
import { Sidebar, SidebarBody, SidebarCreateNewButton, SidebarLink } from "../ui/sidebar";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CirclePlusIcon } from "lucide-react";
import { IoMdArrowRoundBack } from "react-icons/io";
import { CreateCategoryDialog } from "../home/create-category-dialog";
import { getCategories } from "@/app/actions/get-categories";
import { useToast } from "@/hooks/use-toast";
import Category from "@/lib/types/category";
import { usePathname, useRouter } from "next/navigation";
import { getSources } from "@/app/actions/get-sources";
import { useCategoriesStore } from "@/stores/useAllCategories";
import { useSelectedCategoryStore } from "@/stores/useSelectedCategoriesStore";
import { CreateSourceDialog } from "../home/create-source-dialog";
import { useSourcesStore } from "@/stores/useAllSources";

export default function SidebarList({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const pathname = usePathname();
    const router = useRouter();

    const [open, setOpen] = useState(false);
    const { categories, setCategories } = useCategoriesStore();
    const { selectedCategory, setSelectedCategory, resetSelectedCategory } = useSelectedCategoryStore();
    const { sources, setSources, resetSources } = useSourcesStore();
    const { toast } = useToast();
    // Using server actions to fetch data
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // setIsLoading(true);
                const response = await getCategories();

                if (!response) {
                    throw new Error("Failed to fetch categories");
                }

                setCategories(response.data);
            } catch (error) {
                console.log(error);
                toast({
                    variant: "destructive",
                    title: "Ops! Something went wrong",
                    description: "Failed to fetch categories",
                });
            } finally {
                // setIsLoading(false);
            }
        };

        if (pathname === "/" || categories.length === 0) {
            fetchCategories();
        }
    }, [setCategories, categories.length, pathname]);

    // Effect for fetching sources
    useEffect(() => {
        const fetchSources = async () => {
            if (!selectedCategory?.id) return;

            try {
                // setIsLoading(true);
                const response = await getSources({ categoryId: selectedCategory.id });

                if (!response) {
                    throw new Error("Failed to fetch sources");
                }

                setSources(response.data);
            } catch (error) {
                console.error(error);
                toast({
                    variant: "destructive",
                    title: "Ops! Something went wrong",
                    description: "Failed to fetch sources",
                });
            } finally {
                // setIsLoading(false);
            }
        };

        if (pathname === "/sources") {
            fetchSources();
        }
    }, [selectedCategory?.id, pathname]);

    const onSelectCategory = async (category: Category) => {
        try {
            // setIsLoading(true);
            await setSelectedCategory(category);
            router.push("/sources");
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to select category",
            });
        }
    };

    const handleGoBack = () => {
        resetSelectedCategory();
        resetSources();
        router.push("/");
    }


    return (
        <div
            className={cn(
                "rounded-md flex flex-col md:flex-row bg-gray-100 dark:bg-black w-full flex-1 mx-auto border border-neutral-200 dark:border-neutral-700 overflow-hidden",
                "h-screen" // for your use case, use `h-screen` instead of `h-[60vh]`
            )}
        >
            <Sidebar open={open} setOpen={setOpen}>
                <SidebarBody className="justify-between gap-10">
                    <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                        {open ? <Logo /> : <LogoIcon />}
                        <div className="mt-8 flex flex-col gap-2">
                            {pathname === "/sources" && (
                                <div className="">
                                    <SidebarCreateNewButton
                                        icon={<IoMdArrowRoundBack />}
                                        label="Go Back"
                                        onClick={handleGoBack}
                                    />
                                </div>
                            )}
                            {pathname === "/sources" && sources.map((source) => (
                                <SidebarLink key={source._id} item={source} type='source' />
                            ))}
                            {pathname !== "/sources" && categories.map((category) => (
                                <SidebarLink key={category.id} item={category} onClick={(item) => onSelectCategory(item as Category)} type='category' />
                            ))}
                        </div>
                    </div>
                    {pathname !== "/sources" ? (
                        <CreateCategoryDialog>
                            <SidebarCreateNewButton
                                icon={<CirclePlusIcon />}
                                label="Create New"
                            />
                        </CreateCategoryDialog>
                    ) : (
                        <CreateSourceDialog>
                            <SidebarCreateNewButton
                                icon={<CirclePlusIcon />}
                                label="Create New"
                            />
                        </CreateSourceDialog>
                    )}
                </SidebarBody>
            </Sidebar>
            <div className="flex flex-col w-full">
                {/* <Header /> */}
                {children}
            </div>
        </div>
    );
}
export const Logo = () => {
    return (
        <Link
            href="#"
            className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
        >
            <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-medium text-black dark:text-white whitespace-pre"
            >
                News Bug
            </motion.span>
        </Link>
    );
};
export const LogoIcon = () => {
    return (
        <Link
            href="#"
            className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
        >
            <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
        </Link>
    );
};

