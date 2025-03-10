"use client";
import React, { useEffect, useState } from 'react'
import { useSelectedCategoryStore } from '@/stores/useSelectedCategoriesStore'
import { useKeywordsStore } from '@/stores/useKeywords';
import { getKeywords } from '../actions/get-keywords';
import { DataTable } from '@/components/source/data-table';
import { FaMapMarkedAlt } from "react-icons/fa";
import { columns } from '@/components/source/columns';
import { redirect } from 'next/navigation';
import MapView from './map-view';
import { Button } from '@/components/ui/button';

const SourcePage = () => {
  const { selectedCategory } = useSelectedCategoryStore();
  const { keywords, setKeywords } = useKeywordsStore();
  const [viewMap, setViewMap] = useState(true);

  useEffect(() => {
    if (selectedCategory) {
      getKeywords({ categoryId: selectedCategory.id }).then((res) => {
        if (res.success) {
          setKeywords(res.data)
        }
      })
    } else {
      redirect('/')
    }
  }, [selectedCategory, setKeywords])

  return (
    <div
      className="container mx-auto
      w-full
        overflow-y-auto 
        custom-scrollbar 
        will-change-scroll relative"
    >
      {viewMap &&
        <>
          <Button
            onClick={() => setViewMap(!viewMap)}
            className="shadow-md hover:shadow-lg transition-shadow absolute top-4 right-4 z-[19]"
          >
            <FaMapMarkedAlt className="mr-2" />
            {viewMap ? 'Hide Map' : 'Show Map'}
          </Button>
          <MapView keywords={keywords} />
        </>
      }
      <DataTable columns={columns} data={keywords} viewMap={viewMap} setViewMap={setViewMap} />
    </div>
  )
}

export default SourcePage