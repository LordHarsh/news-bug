
import UploadTabs from '@/components/UploadTabs';
import Header from '../components/Header';
import UploadFiles from '../components/UploadFiles';

const Home = () => {
    return (
        <div className='tw-flex tw-justify-center tw-items-center'>
            <UploadTabs />
            {/* <UploadFiles /> */}
        </div>
    );
};

export default Home;