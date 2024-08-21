import {
  Button,
  Container,
  Heading,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";

function HomePage() {
  return (
    <Container my={10}>
      <VStack gap={5}>
        <Heading>AutoDeploy</Heading>
        <Text fontSize="lg">Deploy your ReactJS or NodeJS application</Text>
        <HStack gap={5}>
          <Link to="/react">
            <Button colorScheme="blue">REACT APP</Button>
          </Link>
          <Link to="/node">
            <Button colorScheme="green">NODE APP</Button>
          </Link>
        </HStack>
        <Link to="/deploys">
          <Button>All Deploys</Button>
        </Link>
      </VStack>
    </Container>
  );
}

export default HomePage;
