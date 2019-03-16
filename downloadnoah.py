#---------------------------------------------------------------------------------
# This script is used to download data from earthdata.nasa.gov
# It was adapted from  © Peter Smith and Catalino Cuadrado:
# https://wiki.earthdata.nasa.gov/display/EL/How+To+Access+Data+With+Python
# change the user name, password and link list file 
# only tested for GLDAS NOAH data 
# https://disc.gsfc.nasa.gov/datasets?page=1&project=GLDAS
# 
# Department of Earth Sciences, Uppsala University
# Shunan Feng   fsn.1995@gmail.com 
#---------------------------------------------------------------------------------

 
import requests # get the requsts library from https://github.com/requests/requests
from time import sleep 
 
 
# overriding requests.Session.rebuild_auth to mantain headers when redirected
 
class SessionWithHeaderRedirection(requests.Session):
 
    AUTH_HOST = 'urs.earthdata.nasa.gov'
 
    def __init__(self, username, password):
 
        super().__init__()
 
        self.auth = (username, password)
 
  
 
   # Overrides from the library to keep headers when redirected to or from
 
   # the NASA auth host.
 
    def rebuild_auth(self, prepared_request, response):
 
        headers = prepared_request.headers
 
        url = prepared_request.url
 
  
 
        if 'Authorization' in headers:
 
            original_parsed = requests.utils.urlparse(response.request.url)
 
            redirect_parsed = requests.utils.urlparse(url)
 
  
 
            if (original_parsed.hostname != redirect_parsed.hostname) and \
                    redirect_parsed.hostname != self.AUTH_HOST and \
                    original_parsed.hostname != self.AUTH_HOST:
                del headers['Authorization']
        return
 
  

#url = "https://hydro1.gesdisc.eosdis.nasa.gov/daac-bin/OTF/HTTP_services.cgi?FILENAME=%2Fdata%2FGLDAS%2FGLDAS_NOAH025_M.2.1%2F2000%2FGLDAS_NOAH025_M.A200001.021.nc4&FORMAT=bmM0Lw&BBOX=-60%2C-180%2C90%2C180&LABEL=GLDAS_NOAH025_M.A200001.021.nc4.SUB.nc4&SHORTNAME=GLDAS_NOAH025_M&SERVICE=L34RS_LDAS&VERSION=1.02&DATASET_VERSION=2.1&VARIABLES=Evap_tavg%2CRainf_f_tavg"
  
# create session with the user credentials that will be used to authenticate access to the data
 
username = "username"
 
password= "password"
 
session = SessionWithHeaderRedirection(username, password)
 
  
 # the url of the file we wish to retrieve
f = open("LINKLIST.txt", "r")
x = f.readlines()
f.close()

#
for url in x:
    url = url.strip() 
    sleep(1)
     
    # extract the filename from the url to be used when saving the file
     
    filename = url[url.rfind('GLDAS_NOAH025_M.A'):url.rfind('.nc4')-4]  
     
      
     
    try:
     
        # submit the request using the session
     
        response = session.get(url, stream=True)
     
        print(response.status_code)
     
      
     
        # raise an exception in case of http errors
     
        response.raise_for_status()  
     
      
     
        # save the file
     
        with open(filename, 'wb') as fd:
     
            for chunk in response.iter_content(chunk_size=1024*1024):
     
                fd.write(chunk)
     
      
     
    except requests.exceptions.HTTPError as e:
     
        # handle any errors here
     
        print(e)