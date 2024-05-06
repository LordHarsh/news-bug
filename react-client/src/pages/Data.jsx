import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import NewspaperDetailsTable from "../components/NewspaperDetailsTable";

const Data = () => {
  // const [Newspapers] = useState([
  //   {
  //     _id: {
  //       $oid: "6628248ff920700196319591",
  //     },
  //     name: "Times of India",
  //     date: {
  //       $date: "2006-08-09T00:00:00.000Z",
  //     },
  //     upload_time: {
  //       $date: "2024-04-23T21:13:51.620Z",
  //     },
  //     status: "Processing",
  //     data: [
  //       {
  //         keyword: "virus",
  //         address: "Wisconsin, United States",
  //         latitude: 44.4308975,
  //         longitude: -89.6884637,
  //         page: "page1.txt",
  //         paragraph:
  //           "tobacco December 2013, Canadian health officials said. The traveler got worse, was hospitalized and died Jan. 3. HE RECENT ‘The patient was found _equallly. Most of those ‘announcement | ! have the HSN1 variant —_ deaths occur in the non- Asp Se cine BAGO naw of avian influenza — the industrialized world. are cote The Date Newer w CVS Care- first and only confirmed The agenda will have (einer 5of Wet eid Wis pe ides mark that the retailer will | human case of the virus inthe US. partner with at lolly Koehn inspects her teeth at the Riverfront Dentist in ' in North America. Luckily, the least 30 other countries Barton, Wis, im February 2013. Members of the dental practice | St0P selling tobacco prod- | re aa not over the next five years to donated equipment and time to help give children from «local | ucts atits more than 7,600 | become ill, according to prevent, detect and y Head Start Pues five i ome The Apostle re Act | locations made waves in the | health ial, so the ete respond to peas dis- as measures designed to improve dental access for children. j ._| Was an isolated incident ease threats. US. agencies palitic health community This time, the illness did involved in the agenda 4 million kids have unmet dental needs Heh aioeaes fauded the seer eearoe peronid eehee he ero of national pharmacy retailer | ¥2 i - jealth and Human Ser- Health reform law targets dental ae son who brought it to vices, State, Agriculture . . for its commitment to North America. Next time, and Defense. International care for kids, but gaps remain health while calling on it could be worse. groups include the World tie ean rete susces “That knowledge, and Health Organization, the 3 RSS the knowledge that there Food and Agriculture Orga- YPICAL PATIENTS at the Neighborhood to follow its example. are steps that can reduce _nization of the United Services Organization dental clinic in Oklahoma The drugstore chain's oe 2 SS een Crocs he ane fi anche change in policy, which wie epienic s e zat i City initially visit because of oral health emergen- | WS. cheer in October, | U:S-t0 announce the Health. cies. However, they keep coming back after discovering that | Yas Stuc pecauee cotmne launch of the new global The Centers for Disease the clinic offers affordable dental care. tobacco conflicts with the | POU SSMNy aeoee it; «Control and Pisvention retailer’ purpose of “belp- = 2015 fiscal year budget “when people do find afford it before.” ing people on their path t0 | eeaks anywhere inthe increase of $43 million for ay te on r ier health,” according to : i ci te = eyed as ies pores ssc: | a breey oon fee world aus only a plane: a global health security. It ents,” sai accepts patients ages 8 a y away.” said Laura Holgate, Laura Gutierrez, dental Ider, offe full f (CYS: Caremark enior director - \" irre, Gone Oise Obese 2 ale ana ee But 2s the countdown ‘SM, senior director for See GLOBAL DISEASES, clinic manager. “I's not reduced-price dental ser- secon OF tines doris Chat they didn't know: ———— tion terrorist and threat Page 23 (oral health) was impor- See ORAL HEALTH, reduction with the tant, it’s that they couldn't Page 18 Page 12 | National Security",
  //       },
  //       {
  //         keyword: "influenza",
  //         address: "United States",
  //         latitude: 39.7837304,
  //         longitude: -100.445882,
  //         page: "page1.txt",
  //         paragraph:
  //           "tobacco December 2013, Canadian health officials said. The traveler got worse, was hospitalized and died Jan. 3. HE RECENT ‘The patient was found _equallly. Most of those ‘announcement | ! have the HSN1 variant —_ deaths occur in the non- Asp Se cine BAGO naw of avian influenza — the industrialized world. are cote The Date Newer w CVS Care- first and only confirmed The agenda will have (einer 5of Wet eid Wis pe ides mark that the retailer will | human case of the virus inthe US. partner with at lolly Koehn inspects her teeth at the Riverfront Dentist in ' in North America. Luckily, the least 30 other countries Barton, Wis, im February 2013. Members of the dental practice | St0P selling tobacco prod- | re aa not over the next five years to donated equipment and time to help give children from «local | ucts atits more than 7,600 | become ill, according to prevent, detect and y Head Start Pues five i ome The Apostle re Act | locations made waves in the | health ial, so the ete respond to peas dis- as measures designed to improve dental access for children. j ._| Was an isolated incident ease threats. US. agencies palitic health community This time, the illness did involved in the agenda 4 million kids have unmet dental needs Heh aioeaes fauded the seer eearoe peronid eehee he ero of national pharmacy retailer | ¥2 i - jealth and Human Ser- Health reform law targets dental ae son who brought it to vices, State, Agriculture . . for its commitment to North America. Next time, and Defense. International care for kids, but gaps remain health while calling on it could be worse. groups include the World tie ean rete susces “That knowledge, and Health Organization, the 3 RSS the knowledge that there Food and Agriculture Orga- YPICAL PATIENTS at the Neighborhood to follow its example. are steps that can reduce _nization of the United Services Organization dental clinic in Oklahoma The drugstore chain's oe 2 SS een Crocs he ane fi anche change in policy, which wie epienic s e zat i City initially visit because of oral health emergen- | WS. cheer in October, | U:S-t0 announce the Health. cies. However, they keep coming back after discovering that | Yas Stuc pecauee cotmne launch of the new global The Centers for Disease the clinic offers affordable dental care. tobacco conflicts with the | POU SSMNy aeoee it; «Control and Pisvention retailer’ purpose of “belp- = 2015 fiscal year budget “when people do find afford it before.” ing people on their path t0 | eeaks anywhere inthe increase of $43 million for ay te on r ier health,” according to : i ci te = eyed as ies pores ssc: | a breey oon fee world aus only a plane: a global health security. It ents,” sai accepts patients ages 8 a y away.” said Laura Holgate, Laura Gutierrez, dental Ider, offe full f (CYS: Caremark enior director - \" irre, Gone Oise Obese 2 ale ana ee But 2s the countdown ‘SM, senior director for See GLOBAL DISEASES, clinic manager. “I's not reduced-price dental ser- secon OF tines doris Chat they didn't know: ———— tion terrorist and threat Page 23 (oral health) was impor- See ORAL HEALTH, reduction with the tant, it’s that they couldn't Page 18 Page 12 | National Security",
  //       },
  //       {
  //         keyword: "virus",
  //         address: "United States",
  //         latitude: 39.7837304,
  //         longitude: -100.445882,
  //         page: "page3.txt",
  //         paragraph:
  //           "gett ing their temperatureschecked numerous life-threatening illness- at building security posts, and are es, innate immunity is bolstered for asked to cover their nose and survival. The child on the street mouth. If anyresidentof theapart- beggingismorelikelytoberun ment block gets infected, the do- over by a car than dying from Co- mestichelpsareaskedtogettested  vid-19. This paradox of the ‘trained’ and provide a negative report to innate immunity partly explains re-enter the complex. why the ones living with diarrhoea, Where dothey gettested?Dothey dengue, malariaand tuberculosis get any counselling? As part of in their everyday lives may be less Covid protocol, they are supposed likely to die from Covid-19. This to be quarantined if found positive. may alsoexplain why African Really? In 4x4 sheds, witha family Americans have been dying dis- of 5-10?Butthen, whoreally cares, proportionately from Covid in the as long as ‘we’ are protected. US, when compared to Blacks in And yet, wearenotprotected.We mainland Africa whoare far more had largely ignored the virus, familiar with numerous infections which hasnow mutated—‘learnt’ —_likeebolaandare, therefore, rela-",
  //       },
  //       {
  //         keyword: "LSD",
  //         address: "Rajasthan, India",
  //         latitude: 26.8105777,
  //         longitude: 73.7684549,
  //         page: "page4.txt",
  //         paragraph:
  //           "THE picture is scary. The aerial shot taken by a popular Hindi newspaper shows thou- sands of cattle carcass littered along the high- way to Bikaner in Rajasthan. Reminiscent of the ghastly images of human dead bodies ly- ing buried along the river Ganges, near Alla- habad, when the second phase of deadly Covid-19 epidemic had hit the northern re- gions of country, the Lumpy Skin Disease (LSD) in cattle has also grown in epidemic proportions.",
  //       },
  //       {
  //         keyword: "virus",
  //         address:
  //           "Bikaner, Bikaner Tehsil, Bikaner District, Rajasthan, 334001, India",
  //         latitude: 28.0159286,
  //         longitude: 73.3171367,
  //         page: "page4.txt",
  //         paragraph:
  //           "The report says as many as 6,000 cattle have died in the urban parts of the city from the LSD virus whereas _—_ another 50,000 cattle have perished in the ru- ral hinterland in the Bikaner re- gion. Owners of these cattle are throwing the car- cass in open fields, which serve as an open dumping ground. In another news report, more than 2,000 cattle have died in the hilly State of Himachal Pradesh, and another 53,000 bovine have reportedly contracted the viral infection. In both these cases, improper dis- posal of the dead bodies is causing health and sanitation issues.",
  //       },
  //     ],
  //   },
  //   {
  //     _id: {
  //       $oid: "6628248ff920700196319591",
  //     },
  //     name: "Hindustan Times",
  //     date: {
  //       $date: "2006-08-09T00:00:00.000Z",
  //     },
  //     upload_time: {
  //       $date: "2024-04-23T21:13:51.620Z",
  //     },
  //     status: "Completed",
  //     data: [
  //       {
  //         keyword: "LSD",
  //         address:
  //           "Bikaner, Bikaner Tehsil, Bikaner District, Rajasthan, 334001, India",
  //         latitude: 28.0159286,
  //         longitude: 73.3171367,
  //         page: "page4.txt",
  //         paragraph:
  //           "The report says as many as 6,000 cattle have died in the urban parts of the city from the LSD virus whereas _—_ another 50,000 cattle have perished in the ru- ral hinterland in the Bikaner re- gion. Owners of these cattle are throwing the car- cass in open fields, which serve as an open dumping ground. In another news report, more than 2,000 cattle have died in the hilly State of Himachal Pradesh, and another 53,000 bovine have reportedly contracted the viral infection. In both these cases, improper dis- posal of the dead bodies is causing health and sanitation issues.",
  //       },
  //       {
  //         keyword: "LSD",
  //         address: "India",
  //         latitude: 22.3511148,
  //         longitude: 78.6677428,
  //         page: "page4.txt",
  //         paragraph:
  //           "There is no evidence of the LSD spreading to humans. This is perhaps what keeps us dis- interested of the pandemic proportions that the disease has already spread among cattle in India. Given that the cattle population is about 300 million, and although many experts have said that the peak of spread is already over, the entire effort still has to be on con- taining any further spread of the LSD in bovine population, including buffaloes. Let us not forget, for a small and marginal farmer, the timely vaccination of the affected cattle means a livelihood saved. Remember, India is also the world’s largest producer of milk, with domestic production touching 204 mil- lion tonnes. If the spread goes unchecked, milk production gets impacted, with small and marginal farmers facing a serious drop in incomes. At the trade level, countries can ask for LSD-free trade status.",
  //       },
  //       {
  //         keyword: "LSD",
  //         address: "Hisar, Hisar District, Haryana, India",
  //         latitude: 29.080640950000003,
  //         longitude: 75.788754109493,
  //         page: "page4.txt",
  //         paragraph:
  //           "At present, the Ministry of Agriculture has set up a control room. The Indian Council of Agricultural Research (ICAR) has already an- nounced an indigenous vaccine for LSD. The National Research Centre for Equines (NRCE) at Hisar and the Indian Veterinary Research Institute (IVRI) at Izatnagar - the two institutes that developed the vaccine - can produce about 2.5 lakh dosages per month. Although a significant proportion of the affected cattle have been vaccinated with earlier available and equally effective goat pox vaccines, the new vaccine has to be quickly commercialised to make it easily ac-",
  //       },
  //     ],
  //   },
  //   // Add more newspaper data as needed
  // ]);newspapers, setNewspapers] = useState([
  //   {
  //     _id: {
  //       $oid: "6628248ff920700196319591",
  //     },
  //     name: "Times of India",
  //     date: {
  //       $date: "2006-08-09T00:00:00.000Z",
  //     },
  //     upload_time: {
  //       $date: "2024-04-23T21:13:51.620Z",
  //     },
  //     status: "Processing",
  //     data: [
  //       {
  //         keyword: "virus",
  //         address: "Wisconsin, United States",
  //         latitude: 44.4308975,
  //         longitude: -89.6884637,
  //         page: "page1.txt",
  //         paragraph:
  //           "tobacco December 2013, Canadian health officials said. The traveler got worse, was hospitalized and died Jan. 3. HE RECENT ‘The patient was found _equallly. Most of those ‘announcement | ! have the HSN1 variant —_ deaths occur in the non- Asp Se cine BAGO naw of avian influenza — the industrialized world. are cote The Date Newer w CVS Care- first and only confirmed The agenda will have (einer 5of Wet eid Wis pe ides mark that the retailer will | human case of the virus inthe US. partner with at lolly Koehn inspects her teeth at the Riverfront Dentist in ' in North America. Luckily, the least 30 other countries Barton, Wis, im February 2013. Members of the dental practice | St0P selling tobacco prod- | re aa not over the next five years to donated equipment and time to help give children from «local | ucts atits more than 7,600 | become ill, according to prevent, detect and y Head Start Pues five i ome The Apostle re Act | locations made waves in the | health ial, so the ete respond to peas dis- as measures designed to improve dental access for children. j ._| Was an isolated incident ease threats. US. agencies palitic health community This time, the illness did involved in the agenda 4 million kids have unmet dental needs Heh aioeaes fauded the seer eearoe peronid eehee he ero of national pharmacy retailer | ¥2 i - jealth and Human Ser- Health reform law targets dental ae son who brought it to vices, State, Agriculture . . for its commitment to North America. Next time, and Defense. International care for kids, but gaps remain health while calling on it could be worse. groups include the World tie ean rete susces “That knowledge, and Health Organization, the 3 RSS the knowledge that there Food and Agriculture Orga- YPICAL PATIENTS at the Neighborhood to follow its example. are steps that can reduce _nization of the United Services Organization dental clinic in Oklahoma The drugstore chain's oe 2 SS een Crocs he ane fi anche change in policy, which wie epienic s e zat i City initially visit because of oral health emergen- | WS. cheer in October, | U:S-t0 announce the Health. cies. However, they keep coming back after discovering that | Yas Stuc pecauee cotmne launch of the new global The Centers for Disease the clinic offers affordable dental care. tobacco conflicts with the | POU SSMNy aeoee it; «Control and Pisvention retailer’ purpose of “belp- = 2015 fiscal year budget “when people do find afford it before.” ing people on their path t0 | eeaks anywhere inthe increase of $43 million for ay te on r ier health,” according to : i ci te = eyed as ies pores ssc: | a breey oon fee world aus only a plane: a global health security. It ents,” sai accepts patients ages 8 a y away.” said Laura Holgate, Laura Gutierrez, dental Ider, offe full f (CYS: Caremark enior director - \" irre, Gone Oise Obese 2 ale ana ee But 2s the countdown ‘SM, senior director for See GLOBAL DISEASES, clinic manager. “I's not reduced-price dental ser- secon OF tines doris Chat they didn't know: ———— tion terrorist and threat Page 23 (oral health) was impor- See ORAL HEALTH, reduction with the tant, it’s that they couldn't Page 18 Page 12 | National Security",
  //       },
  //       {
  //         keyword: "influenza",
  //         address: "United States",
  //         latitude: 39.7837304,
  //         longitude: -100.445882,
  //         page: "page1.txt",
  //         paragraph:
  //           "tobacco December 2013, Canadian health officials said. The traveler got worse, was hospitalized and died Jan. 3. HE RECENT ‘The patient was found _equallly. Most of those ‘announcement | ! have the HSN1 variant —_ deaths occur in the non- Asp Se cine BAGO naw of avian influenza — the industrialized world. are cote The Date Newer w CVS Care- first and only confirmed The agenda will have (einer 5of Wet eid Wis pe ides mark that the retailer will | human case of the virus inthe US. partner with at lolly Koehn inspects her teeth at the Riverfront Dentist in ' in North America. Luckily, the least 30 other countries Barton, Wis, im February 2013. Members of the dental practice | St0P selling tobacco prod- | re aa not over the next five years to donated equipment and time to help give children from «local | ucts atits more than 7,600 | become ill, according to prevent, detect and y Head Start Pues five i ome The Apostle re Act | locations made waves in the | health ial, so the ete respond to peas dis- as measures designed to improve dental access for children. j ._| Was an isolated incident ease threats. US. agencies palitic health community This time, the illness did involved in the agenda 4 million kids have unmet dental needs Heh aioeaes fauded the seer eearoe peronid eehee he ero of national pharmacy retailer | ¥2 i - jealth and Human Ser- Health reform law targets dental ae son who brought it to vices, State, Agriculture . . for its commitment to North America. Next time, and Defense. International care for kids, but gaps remain health while calling on it could be worse. groups include the World tie ean rete susces “That knowledge, and Health Organization, the 3 RSS the knowledge that there Food and Agriculture Orga- YPICAL PATIENTS at the Neighborhood to follow its example. are steps that can reduce _nization of the United Services Organization dental clinic in Oklahoma The drugstore chain's oe 2 SS een Crocs he ane fi anche change in policy, which wie epienic s e zat i City initially visit because of oral health emergen- | WS. cheer in October, | U:S-t0 announce the Health. cies. However, they keep coming back after discovering that | Yas Stuc pecauee cotmne launch of the new global The Centers for Disease the clinic offers affordable dental care. tobacco conflicts with the | POU SSMNy aeoee it; «Control and Pisvention retailer’ purpose of “belp- = 2015 fiscal year budget “when people do find afford it before.” ing people on their path t0 | eeaks anywhere inthe increase of $43 million for ay te on r ier health,” according to : i ci te = eyed as ies pores ssc: | a breey oon fee world aus only a plane: a global health security. It ents,” sai accepts patients ages 8 a y away.” said Laura Holgate, Laura Gutierrez, dental Ider, offe full f (CYS: Caremark enior director - \" irre, Gone Oise Obese 2 ale ana ee But 2s the countdown ‘SM, senior director for See GLOBAL DISEASES, clinic manager. “I's not reduced-price dental ser- secon OF tines doris Chat they didn't know: ———— tion terrorist and threat Page 23 (oral health) was impor- See ORAL HEALTH, reduction with the tant, it’s that they couldn't Page 18 Page 12 | National Security",
  //       },
  //       {
  //         keyword: "virus",
  //         address: "United States",
  //         latitude: 39.7837304,
  //         longitude: -100.445882,
  //         page: "page3.txt",
  //         paragraph:
  //           "gett ing their temperatureschecked numerous life-threatening illness- at building security posts, and are es, innate immunity is bolstered for asked to cover their nose and survival. The child on the street mouth. If anyresidentof theapart- beggingismorelikelytoberun ment block gets infected, the do- over by a car than dying from Co- mestichelpsareaskedtogettested  vid-19. This paradox of the ‘trained’ and provide a negative report to innate immunity partly explains re-enter the complex. why the ones living with diarrhoea, Where dothey gettested?Dothey dengue, malariaand tuberculosis get any counselling? As part of in their everyday lives may be less Covid protocol, they are supposed likely to die from Covid-19. This to be quarantined if found positive. may alsoexplain why African Really? In 4x4 sheds, witha family Americans have been dying dis- of 5-10?Butthen, whoreally cares, proportionately from Covid in the as long as ‘we’ are protected. US, when compared to Blacks in And yet, wearenotprotected.We mainland Africa whoare far more had largely ignored the virus, familiar with numerous infections which hasnow mutated—‘learnt’ —_likeebolaandare, therefore, rela-",
  //       },
  //       {
  //         keyword: "LSD",
  //         address: "Rajasthan, India",
  //         latitude: 26.8105777,
  //         longitude: 73.7684549,
  //         page: "page4.txt",
  //         paragraph:
  //           "THE picture is scary. The aerial shot taken by a popular Hindi newspaper shows thou- sands of cattle carcass littered along the high- way to Bikaner in Rajasthan. Reminiscent of the ghastly images of human dead bodies ly- ing buried along the river Ganges, near Alla- habad, when the second phase of deadly Covid-19 epidemic had hit the northern re- gions of country, the Lumpy Skin Disease (LSD) in cattle has also grown in epidemic proportions.",
  //       },
  //       {
  //         keyword: "virus",
  //         address:
  //           "Bikaner, Bikaner Tehsil, Bikaner District, Rajasthan, 334001, India",
  //         latitude: 28.0159286,
  //         longitude: 73.3171367,
  //         page: "page4.txt",
  //         paragraph:
  //           "The report says as many as 6,000 cattle have died in the urban parts of the city from the LSD virus whereas _—_ another 50,000 cattle have perished in the ru- ral hinterland in the Bikaner re- gion. Owners of these cattle are throwing the car- cass in open fields, which serve as an open dumping ground. In another news report, more than 2,000 cattle have died in the hilly State of Himachal Pradesh, and another 53,000 bovine have reportedly contracted the viral infection. In both these cases, improper dis- posal of the dead bodies is causing health and sanitation issues.",
  //       },
  //     ],
  //   },
  //   {
  //     _id: {
  //       $oid: "6628248ff920700196319591",
  //     },
  //     name: "Hindustan Times",
  //     date: {
  //       $date: "2006-08-09T00:00:00.000Z",
  //     },
  //     upload_time: {
  //       $date: "2024-04-23T21:13:51.620Z",
  //     },
  //     status: "Completed",
  //     data: [
  //       {
  //         keyword: "LSD",
  //         address:
  //           "Bikaner, Bikaner Tehsil, Bikaner District, Rajasthan, 334001, India",
  //         latitude: 28.0159286,
  //         longitude: 73.3171367,
  //         page: "page4.txt",
  //         paragraph:
  //           "The report says as many as 6,000 cattle have died in the urban parts of the city from the LSD virus whereas _—_ another 50,000 cattle have perished in the ru- ral hinterland in the Bikaner re- gion. Owners of these cattle are throwing the car- cass in open fields, which serve as an open dumping ground. In another news report, more than 2,000 cattle have died in the hilly State of Himachal Pradesh, and another 53,000 bovine have reportedly contracted the viral infection. In both these cases, improper dis- posal of the dead bodies is causing health and sanitation issues.",
  //       },
  //       {
  //         keyword: "LSD",
  //         address: "India",
  //         latitude: 22.3511148,
  //         longitude: 78.6677428,
  //         page: "page4.txt",
  //         paragraph:
  //           "There is no evidence of the LSD spreading to humans. This is perhaps what keeps us dis- interested of the pandemic proportions that the disease has already spread among cattle in India. Given that the cattle population is about 300 million, and although many experts have said that the peak of spread is already over, the entire effort still has to be on con- taining any further spread of the LSD in bovine population, including buffaloes. Let us not forget, for a small and marginal farmer, the timely vaccination of the affected cattle means a livelihood saved. Remember, India is also the world’s largest producer of milk, with domestic production touching 204 mil- lion tonnes. If the spread goes unchecked, milk production gets impacted, with small and marginal farmers facing a serious drop in incomes. At the trade level, countries can ask for LSD-free trade status.",
  //       },
  //       {
  //         keyword: "LSD",
  //         address: "Hisar, Hisar District, Haryana, India",
  //         latitude: 29.080640950000003,
  //         longitude: 75.788754109493,
  //         page: "page4.txt",
  //         paragraph:
  //           "At present, the Ministry of Agriculture has set up a control room. The Indian Council of Agricultural Research (ICAR) has already an- nounced an indigenous vaccine for LSD. The National Research Centre for Equines (NRCE) at Hisar and the Indian Veterinary Research Institute (IVRI) at Izatnagar - the two institutes that developed the vaccine - can produce about 2.5 lakh dosages per month. Although a significant proportion of the affected cattle have been vaccinated with earlier available and equally effective goat pox vaccines, the new vaccine has to be quickly commercialised to make it easily ac-",
  //       },
  //     ],
  //   },
  //   // Add more newspaper data as needed
  // ]);
  const [newspapers, setNewspapers] = useState([]);
  const [selectedNewspaper, setSelectedNewspaper] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const ISODate = (date) => {
    const d = new Date(date);
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return d.toLocaleDateString(undefined, options);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const backend_url = import.meta.env.VITE_BACKEND_URL;
        if (!backend_url) {
          throw new Error("REACT_APP_BACKEND_URL is not defined");
        }
        const response = await fetch(`${backend_url}/data/names`);
        if (!response.ok) {
          throw new Error("Server is down. Can't fetch respone"); // Replace with more specific handling if needed
        }
        const data = await response.json();
        setNewspapers(data);
      } catch (error) {
        setError(error.message); // Set the error message
      } finally {
        setIsLoading(false); // Set loading state to false in any case
      }
    };

    fetchData();
  }, []);

  const handleNewspaperClick = (newspaper) => {
    setSelectedNewspaper(newspaper);
  };

  return (
    <div className="">
      <Header />
      <div className="row">
        {" "}
        {/* Added row for layout */}
        <div className="col-md-3 sidebar tw-w-1/5">
          {/* ... your sidebar code ... */}
          <h3 className="tw-p-4">Newspapers</h3>
          
          {isLoading && (
            <div className="tw-flex-col tw-pl-4 justify-content-center tw-align-middle">
              <h5 className="">Fetching newspapers...</h5>
              <div className="spinner-border tw-justify-center" role="status">
                <span className="sr-only"></span>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-danger">
              Error loading data: {error}
            </div>
          )}

          {!isLoading && !error && (
            <ul className="list-group" id="newspaperList">
            {newspapers.map((newspaper) => (
              <li
                key={newspaper._id} // Assume newspapers have IDs
                className="list-group-item"
                onClick={() => handleNewspaperClick(newspaper)}
              >
                {newspaper.name} - {ISODate(newspaper.date)} <br />
                {newspaper.status}
              </li>
            ))}
          </ul>
          )}
        </div>
        <div className="col-md-9 main-content tw-w-4/5">
          {" "}
          {/* Main content area */}
          {selectedNewspaper && (
            <NewspaperDetailsTable newspaper={selectedNewspaper} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Data;
