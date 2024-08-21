import {
  Container,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Link,
} from "@chakra-ui/react";
import axios from "axios";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

function ViewDeployedApps() {
  const [records, setRecords] = useState([]);

  const fetchData = async () => {
    toast.promise(
      axios.get(`${import.meta.env.VITE_APP_BASE_URL}/stacks`).then((res) => {
        const data = res.data;
        setRecords(data.records);
      }),
      {
        loading: "Loading...",
        success: "Data Fetched!",
        error: "Something went wrong...",
      }
    );
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Container maxW="container.sm" my={10}>
      <TableContainer>
        <Table variant="simple">
          <TableCaption>Deployed Application Information</TableCaption>
          <Thead>
            <Th>Email</Th>
            <Th>Repository</Th>
            <Th>Application Type</Th>
            <Th>Url</Th>
          </Thead>
          <Tbody>
            {records.map((d) => {
              return (
                <Tr key={d.stackName}>
                  <Td>{d.email}</Td>
                  <Td>{d.repository}</Td>
                  <Td>{d.appType}</Td>
                  <Td>
                    <Link
                      color="teal.500"
                      href={`http://${d.publicIp}`}
                      isExternal
                    >
                      Link
                    </Link>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default ViewDeployedApps;
