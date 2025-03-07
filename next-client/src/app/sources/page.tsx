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
        overflow-y-auto 
        custom-scrollbar 
        will-change-scroll"
    >
      <Button className='relative float-right mx-4 mt-6'
        onClick={() => setViewMap(!viewMap)}>
        <FaMapMarkedAlt />
      </Button>
      {viewMap && <MapView keywords={keywords} />}
      <DataTable columns={columns} data={keywords} />
    </div>
  )
}

export default SourcePage