import {
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Radio,
  RadioGroup,
  VStack,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Controller, useWatch, useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

const environmentVariableschema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  value: z.string().min(1, { message: "Value is required." }),
});

const schema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required." })
    .email({ message: "Must be in valid email format." }),
  gitUrl: z
    .string()
    .min(1, { message: "Git Url is required." })
    .url({ message: "Invalid URL format." })
    .includes("github.com", { message: "Url must be of github repo." }),
  baseDirectory: z.string().optional(),
  entrypoint: z.string().min(1, { message: "Entry point file is required." }),
  port: z.string().min(1, { message: "Port is required." }).regex(/^\d+$/, {
    message: "Port must contain only numbers.",
  }),
  repoAccess: z
    .string()
    .nonempty({ message: "Please select git repo access." }),
  accessToken: z.string().optional(),
  environmentVariables: z.array(environmentVariableschema).optional(),
});

function NodeFormPage() {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const { fields, append, remove } = useFieldArray({
    name: "environmentVariables",
    control,
  });

  const selectedOption = useWatch({
    control,
    name: "repoAccess",
  });

  const onSubmit = async (data) => {
    toast.promise(
      axios
        .post(`${import.meta.env.VITE_APP_BASE_URL}/node`, {
          ...data,
          appType: "Node",
        })
        .then((res) => {
          const data = res.data;
          console.log(data);
          reset();
        }),
      {
        loading: "Loading...",
        success: "Deployment Started! Check your Email.",
        error: "Something went wrong...",
      }
    );
  };

  return (
    <Container my={10}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <VStack gap={6}>
          <Heading>Node App Details</Heading>
          <FormControl isInvalid={errors.email}>
            <FormLabel>Email</FormLabel>
            <Input type="email" {...register("email")} />
            {!errors.email ? (
              <FormHelperText>
                Enter the email you'd like to receive the deployed url on.
              </FormHelperText>
            ) : (
              <FormErrorMessage>{errors.email.message}</FormErrorMessage>
            )}
          </FormControl>
          <FormControl isInvalid={errors.gitUrl}>
            <FormLabel>Git Repo URL</FormLabel>
            <Input type="text" {...register("gitUrl")} />
            {!errors.gitUrl ? (
              <FormHelperText>
                Enter the repository url that you want to deploy.
              </FormHelperText>
            ) : (
              <FormErrorMessage>{errors.gitUrl.message}</FormErrorMessage>
            )}
          </FormControl>
          <FormControl isInvalid={errors.baseDirectory}>
            <FormLabel>Base Directory</FormLabel>
            <Input type="text" {...register("baseDirectory")} />
            {!errors.baseDirectory ? (
              <FormHelperText>
                Enter the directory path of application.
              </FormHelperText>
            ) : (
              <FormErrorMessage>
                {errors.baseDirectory.message}
              </FormErrorMessage>
            )}
          </FormControl>
          <HStack alignItems="start" w="full">
            <FormControl isInvalid={errors.entrypoint}>
              <FormLabel>Entry Point File</FormLabel>
              <Input type="text" {...register("entrypoint")} />
              {!errors.entrypoint ? (
                <FormHelperText>Enter the entrypoint file.</FormHelperText>
              ) : (
                <FormErrorMessage>{errors.entrypoint.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl isInvalid={errors.port}>
              <FormLabel>Port</FormLabel>
              <Input type="text" {...register("port")} />
              {!errors.port ? (
                <FormHelperText>
                  Application port in development.
                </FormHelperText>
              ) : (
                <FormErrorMessage>{errors.port.message}</FormErrorMessage>
              )}
            </FormControl>
          </HStack>
          <FormControl isInvalid={errors.repoAccess}>
            <FormLabel>Repository Access</FormLabel>
            <Controller
              name="repoAccess"
              control={control}
              defaultValue=""
              render={({ field }) => (
                <RadioGroup {...field}>
                  <HStack gap={4}>
                    <Radio value="public">Public</Radio>
                    <Radio value="private">Private</Radio>
                  </HStack>
                </RadioGroup>
              )}
            />
            {!errors.repoAccess ? (
              <FormHelperText>
                Select whether repository is public or private.
              </FormHelperText>
            ) : (
              <FormErrorMessage>{errors.repoAccess.message}</FormErrorMessage>
            )}
          </FormControl>
          {selectedOption === "private" && (
            <FormControl isInvalid={errors.accessToken}>
              <FormLabel>Access Token</FormLabel>
              <Input
                type="password"
                {...register("accessToken", {
                  validate: (value) => {
                    if (selectedOption === "private" && !value.trim()) {
                      return "Access token is required when repository is private.";
                    }
                    return true;
                  },
                })}
              />
              {!errors.accessToken ? (
                <FormHelperText>Enter your GitHub access token.</FormHelperText>
              ) : (
                <FormErrorMessage>
                  {errors.accessToken?.message}
                </FormErrorMessage>
              )}
            </FormControl>
          )}
          <FormControl>
            <FormLabel>Environment Variables</FormLabel>
            {fields.map((field, index) => (
              <HStack key={field.id} alignItems="end">
                <FormControl
                  isInvalid={errors.environmentVariables?.[index]?.name}
                >
                  <FormLabel>Name</FormLabel>
                  <Input
                    type="text"
                    {...register(`environmentVariables.${index}.name`)}
                  />
                  <FormErrorMessage>
                    {errors.environmentVariables?.[index]?.name?.message}
                  </FormErrorMessage>
                </FormControl>
                <FormControl
                  isInvalid={errors.environmentVariables?.[index]?.value}
                >
                  <FormLabel>Value</FormLabel>
                  <Input
                    type="text"
                    {...register(`environmentVariables.${index}.value`)}
                  />
                  <FormErrorMessage>
                    {errors.environmentVariables?.[index]?.value?.message}
                  </FormErrorMessage>
                </FormControl>
                <Button onClick={() => remove(index)} colorScheme="red">
                  &mdash;
                </Button>
              </HStack>
            ))}
            <Button
              mt={4}
              onClick={() => append({ name: "", value: "" })}
              colorScheme="blue"
            >
              + Add Environment Variable
            </Button>
          </FormControl>
          <Button
            mt={4}
            colorScheme="teal"
            isLoading={isSubmitting}
            type="submit"
            width="full"
          >
            Submit
          </Button>
        </VStack>
      </form>
    </Container>
  );
}

export default NodeFormPage;
